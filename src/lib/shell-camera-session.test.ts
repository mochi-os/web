// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: Apache-2.0

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { cameraOpen } from './shell-camera-session'

// The in-shell path activates when isInShell() is true, simulated the same way
// shell-storage's suite does: parent !== window, parent.document throws.
let parentPostMessage: ReturnType<typeof vi.fn>
let parentStub: { postMessage: ReturnType<typeof vi.fn>; readonly document: never }

function shellMode() {
  parentPostMessage = vi.fn()
  parentStub = {
    postMessage: parentPostMessage,
    get document(): never {
      throw new DOMException('Blocked', 'SecurityError')
    },
  }
  Object.defineProperty(window, 'parent', {
    configurable: true,
    get() {
      return parentStub
    },
  })
}

afterEach(() => {
  Object.defineProperty(window, 'parent', {
    configurable: true,
    get() {
      return window
    },
  })
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

function fromParent(data: unknown, origin: string = window.location.origin) {
  const event = new MessageEvent('message', { data, origin })
  Object.defineProperty(event, 'source', { value: parentStub, configurable: true })
  window.dispatchEvent(event)
}

const bitmap = () => ({ close: vi.fn() }) as unknown as ImageBitmap

describe('cameraOpen in the shell', () => {
  beforeEach(shellMode)

  it('opens over the protocol and delivers frames until end', async () => {
    const frames: ImageBitmap[] = []
    const ends: string[] = []
    const promise = cameraOpen({ frame: (f) => frames.push(f), end: (r) => ends.push(r) })
    const start = parentPostMessage.mock.calls.find((c) => c[0]?.type === 'camera.start')?.[0]
    expect(start).toBeTruthy()
    fromParent({ type: 'camera.result', requestId: start.requestId, ok: true, devices: [{ id: 'cam1', label: 'Front' }] })
    const { opened } = await promise
    expect(opened).toEqual({ ok: true, devices: [{ id: 'cam1', label: 'Front' }] })
    fromParent({ type: 'camera.frame', requestId: start.requestId, frame: bitmap() })
    fromParent({ type: 'camera.frame', requestId: start.requestId, frame: bitmap() })
    expect(frames).toHaveLength(2)
    fromParent({ type: 'camera.end', requestId: start.requestId, reason: 'aborted' })
    expect(ends).toEqual(['aborted'])
    // A straggler frame after the end is closed, not delivered.
    const late = bitmap()
    fromParent({ type: 'camera.frame', requestId: start.requestId, frame: late })
    expect(frames).toHaveLength(2)
    expect((late as unknown as { close: ReturnType<typeof vi.fn> }).close).toHaveBeenCalled()
  })

  it('reports a refused open', async () => {
    const promise = cameraOpen({ frame: () => {} })
    const start = parentPostMessage.mock.calls.find((c) => c[0]?.type === 'camera.start')?.[0]
    fromParent({
      type: 'camera.result',
      requestId: start.requestId,
      ok: false,
      error: { name: 'NotAllowedError', message: 'Camera permission not granted' },
    })
    const { opened } = await promise
    expect(opened.ok).toBe(false)
    if (!opened.ok) expect(opened.error?.name).toBe('NotAllowedError')
  })

  it('stop posts camera.stop and drops later frames', async () => {
    const frames: ImageBitmap[] = []
    const promise = cameraOpen({ frame: (f) => frames.push(f) })
    const start = parentPostMessage.mock.calls.find((c) => c[0]?.type === 'camera.start')?.[0]
    fromParent({ type: 'camera.result', requestId: start.requestId, ok: true, devices: [] })
    const { session } = await promise
    session.stop()
    expect(parentPostMessage.mock.calls.some((c) => c[0]?.type === 'camera.stop')).toBe(true)
    const late = bitmap()
    fromParent({ type: 'camera.frame', requestId: start.requestId, frame: late })
    expect(frames).toHaveLength(0)
  })

  it('tells the shell to stop when the deadline passes unanswered', async () => {
    // A consent prompt answered after this point would otherwise start a
    // camera that nothing owns: the session already reported TimeoutError
    // and no one will ever call stop().
    vi.useFakeTimers()
    try {
      const promise = cameraOpen({ frame: () => {} })
      const start = parentPostMessage.mock.calls.find((c) => c[0]?.type === 'camera.start')?.[0]
      await vi.advanceTimersByTimeAsync(30_000)
      const { opened } = await promise
      expect(opened).toMatchObject({ ok: false, error: { name: 'TimeoutError' } })
      const stop = parentPostMessage.mock.calls.find((c) => c[0]?.type === 'camera.stop')?.[0]
      expect(stop).toEqual({ type: 'camera.stop', requestId: start.requestId })
    } finally {
      vi.useRealTimers()
    }
  })

  it('ignores messages that are not from the parent', async () => {
    const promise = cameraOpen({ frame: () => {} })
    const start = parentPostMessage.mock.calls.find((c) => c[0]?.type === 'camera.start')?.[0]
    // A sibling forging the parent's answer must not resolve the open.
    const event = new MessageEvent('message', {
      data: { type: 'camera.result', requestId: start.requestId, ok: true, devices: [] },
      origin: window.location.origin,
    })
    Object.defineProperty(event, 'source', { value: window, configurable: true })
    window.dispatchEvent(event)
    const settled = await Promise.race([promise.then(() => 'RESOLVED'), new Promise((r) => setTimeout(() => r('PENDING'), 30))])
    expect(settled).toBe('PENDING')
    fromParent({ type: 'camera.result', requestId: start.requestId, ok: true, devices: [] })
    await promise
  })
})

describe('cameraOpen outside the shell', () => {
  it('opens the camera directly and pumps frames', async () => {
    const track = { kind: 'video', stop: vi.fn(), onended: null as null | (() => void) }
    const stream = { getTracks: () => [track], getVideoTracks: () => [track] }
    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: {
        getUserMedia: vi.fn(() => Promise.resolve(stream)),
        enumerateDevices: () =>
          Promise.resolve([
            { kind: 'videoinput', deviceId: 'cam1', label: 'Front' },
            { kind: 'audioinput', deviceId: 'mic1', label: 'Mic' },
          ]),
      },
    })
    vi.stubGlobal('createImageBitmap', vi.fn(() => Promise.resolve(bitmap())))
    Object.defineProperty(HTMLMediaElement.prototype, 'srcObject', {
      configurable: true,
      get: () => null,
      set: () => {},
    })
    HTMLMediaElement.prototype.play = vi.fn(() => Promise.resolve())
    Object.defineProperty(HTMLMediaElement.prototype, 'readyState', {
      configurable: true,
      get: () => 4,
    })

    const frames: ImageBitmap[] = []
    const { session, opened } = await cameraOpen({ frame: (f) => frames.push(f) })
    expect(opened).toEqual({ ok: true, devices: [{ id: 'cam1', label: 'Front' }] })
    await new Promise((r) => setTimeout(r, 120)) // the no-rVFC fallback runs at ~33 ms
    expect(frames.length).toBeGreaterThan(0)
    session.stop()
    expect(track.stop).toHaveBeenCalled()
  })

  it('reports the missing capability', async () => {
    Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: undefined })
    const { opened } = await cameraOpen({ frame: () => {} })
    expect(opened.ok).toBe(false)
    if (!opened.ok) expect(opened.error?.name).toBe('NotSupportedError')
  })
})
