// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: Apache-2.0

/**
 * Camera session for Mochi apps — the streaming sibling of the microphone
 * session. Opaque-origin iframes must not call getUserMedia directly (no
 * permission can even persist against an opaque origin): inside the shell the
 * top window owns the tracks and streams one transferable ImageBitmap per
 * camera frame over postMessage (camera.start / camera.frame / camera.stop /
 * camera.end, gated on the app's Mochi `camera` grant); outside the shell the
 * same API drives getUserMedia directly with an identical local frame pump.
 *
 * Every delivered frame is the receiver's to close(): the pump drops frames at
 * the source while one is in flight, so a slow consumer degrades to a lower
 * frame rate instead of a queue.
 */

import { isInShell } from './shell-bridge'

export type CameraError = { name: string; message: string }

export type CameraDevice = { id: string; label: string }

export type CameraOpen =
  | { ok: true; devices: CameraDevice[] }
  | { ok: false; cancelled?: boolean; error?: CameraError }

export type CameraOptions = {
  /** deviceId to prefer; a vanished device falls back to the default camera. */
  device?: string
  /** One frame per camera frame. The frame is yours: close() it when done. */
  frame: (frame: ImageBitmap) => void
  /** The stream ended without a stop() call (navigation, tab hidden, unplug). */
  end?: (reason: string) => void
}

export type CameraSession = {
  stop: () => void
}

let sequence = 0

/**
 * Open the camera and stream frames until stop(). Resolves with the open
 * outcome; frames begin arriving after an ok. At most one session should be
 * live at a time — the shell enforces it, the direct path assumes it.
 */
export function cameraOpen(options: CameraOptions): Promise<{ session: CameraSession; opened: CameraOpen }> {
  return isInShell() ? shellOpen(options) : directOpen(options)
}

// ---------------------------------------------------------------- in shell

function shellOpen(options: CameraOptions): Promise<{ session: CameraSession; opened: CameraOpen }> {
  const requestId = ++sequence
  let live = true

  return new Promise((resolve) => {
    const finish = (opened: CameraOpen) => {
      resolve({ session: { stop }, opened })
    }
    // The listener outlives the session by a moment: a frame already in
    // flight when the session ends still needs its close() (the !live branch
    // below), or the bitmap lingers until GC.
    function retire() {
      setTimeout(() => window.removeEventListener('message', onMessage), 2000)
    }
    function stop() {
      if (!live) return
      live = false
      retire()
      window.parent.postMessage({ type: 'camera.stop', requestId }, '*')
    }
    function onMessage(event: MessageEvent) {
      // Only the shell (our direct parent) may drive the session — the same
      // source pin every shell bridge listener applies.
      if (event.source !== window.parent) return
      const data = event.data as { type?: string; requestId?: number } | null
      if (!data || data.requestId !== requestId) return
      if (data.type === 'camera.result') {
        const result = data as unknown as { ok: boolean; devices?: CameraDevice[]; cancelled?: boolean; error?: CameraError }
        if (result.ok) {
          finish({ ok: true, devices: result.devices ?? [] })
        } else {
          live = false
          retire()
          finish({ ok: false, cancelled: result.cancelled, error: result.error })
        }
        return
      }
      if (data.type === 'camera.frame') {
        const frame = (data as unknown as { frame: ImageBitmap }).frame
        if (!live) {
          try { frame.close() } catch { /* already closed */ }
          return
        }
        options.frame(frame)
        return
      }
      if (data.type === 'camera.end') {
        const reason = (data as unknown as { reason?: string }).reason ?? 'ended'
        const wasLive = live
        live = false
        retire()
        if (wasLive) options.end?.(reason)
      }
    }
    window.addEventListener('message', onMessage)
    window.parent.postMessage({ type: 'camera.start', requestId, device: options.device ?? '' }, '*')
  })
}

// ---------------------------------------------------------------- top window

function directOpen(options: CameraOptions): Promise<{ session: CameraSession; opened: CameraOpen }> {
  const media = typeof navigator !== 'undefined' ? navigator.mediaDevices : undefined
  const stop = { closed: false, stream: null as MediaStream | null, video: null as HTMLVideoElement | null }

  function close(reason: string | null) {
    if (stop.closed) return
    stop.closed = true
    if (stop.video) {
      try { stop.video.srcObject = null } catch { /* detached */ }
      stop.video = null
    }
    stop.stream?.getTracks().forEach((track) => {
      try { track.stop() } catch { /* already stopped */ }
    })
    stop.stream = null
    if (reason) options.end?.(reason)
  }

  const session: CameraSession = { stop: () => close(null) }

  if (!media?.getUserMedia || typeof createImageBitmap === 'undefined') {
    return Promise.resolve({
      session,
      // eslint-disable-next-line lingui/no-unlocalized-strings -- CameraError mirrors DOMException: name and message are diagnostics the caller branches on, and every other failure path carries the browser's own untranslated message
      opened: { ok: false, error: { name: 'NotSupportedError', message: 'Camera access requires a secure context' } },
    })
  }

  const constraints: MediaStreamConstraints = {
    video: {
      width: { ideal: 640 },
      height: { ideal: 480 },
      frameRate: { ideal: 30 },
      ...(options.device ? { deviceId: { exact: options.device } } : {}),
    },
  }

  const open = (wanted: MediaStreamConstraints, retried: boolean): Promise<{ session: CameraSession; opened: CameraOpen }> =>
    media.getUserMedia(wanted).then(
      (stream) => {
        if (stop.closed) {
          stream.getTracks().forEach((track) => track.stop())
          return { session, opened: { ok: false, cancelled: true } as CameraOpen }
        }
        stop.stream = stream
        const track = stream.getVideoTracks()[0]
        if (track) track.onended = () => close('ended')
        pump(stream)
        return media.enumerateDevices?.().then(
          (all) => ({
            session,
            opened: {
              ok: true as const,
              devices: all
                .filter((d) => d.kind === 'videoinput')
                .map((d) => ({ id: d.deviceId || '', label: d.label || '' })),
            },
          }),
          () => ({ session, opened: { ok: true as const, devices: [] } })
        ) ?? { session, opened: { ok: true as const, devices: [] } }
      },
      (err: unknown) => {
        // A remembered device that has since been unplugged must not fail the
        // whole open — retry once unconstrained.
        if (!retried && options.device) {
          return open({ video: { width: { ideal: 640 }, height: { ideal: 480 }, frameRate: { ideal: 30 } } }, true)
        }
        const e = err as { name?: string; message?: string } | null
        return {
          session,
          opened: {
            ok: false as const,
            // eslint-disable-next-line lingui/no-unlocalized-strings -- 'Error' is the DOMException name fallback, not a label: the message beside it comes from the browser
            error: { name: e?.name ?? 'Error', message: e?.message ?? String(err) },
          },
        }
      }
    )

  function pump(stream: MediaStream) {
    const video = document.createElement('video')
    video.muted = true
    video.playsInline = true
    video.srcObject = stream
    stop.video = video
    video.play()?.catch(() => { /* muted local streams do not meaningfully fail */ })
    let pending = false
    const grab = () => {
      if (stop.closed) return
      if (!pending && video.readyState >= 2) {
        pending = true
        createImageBitmap(video).then(
          (bitmap) => {
            pending = false
            if (stop.closed) {
              try { bitmap.close() } catch { /* already closed */ }
              return
            }
            options.frame(bitmap)
          },
          () => { pending = false }
        )
      }
      schedule()
    }
    const schedule = () => {
      if (stop.closed) return
      const rvfc = (video as HTMLVideoElement & { requestVideoFrameCallback?: (cb: () => void) => void }).requestVideoFrameCallback
      if (rvfc) rvfc.call(video, grab)
      else setTimeout(grab, 33)
    }
    schedule()
  }

  return open(constraints, false)
}
