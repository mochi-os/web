// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: Apache-2.0

/**
 * Microphone session host, used by the local recorder path and mirrored in
 * shell.js: opaque-origin iframes cannot call getUserMedia, so the shell owns
 * the stream and returns a Blob.
 */

export type MicSessionState = 'idle' | 'requesting' | 'recording' | 'stopping'

export type MicSessionError = {
  name: string
  message: string
}

export type MicSessionResult =
  | {
      ok: true
      blob: Blob
      mimeType: string
      filename: string
      durationSecs: number
    }
  | {
      ok: false
      cancelled?: boolean
      error?: MicSessionError
    }

const MIC_PREFERRED_MIME_TYPES = [
  'audio/webm;codecs=opus',
  'audio/webm',
  'audio/mp4',
  'audio/ogg;codecs=opus',
] as const

export function micDurationSecs(elapsedMs: number): number {
  return Math.max(1, Math.round(elapsedMs / 1000))
}

export function micFilenameForMime(mimeType: string): string {
  const lower = mimeType.toLowerCase()
  if (lower.includes('mp4') || lower.includes('m4a') || lower.includes('aac')) {
    return 'Voice Note.mp4'
  }
  if (lower.includes('ogg')) {
    return 'Voice Note.ogg'
  }
  return 'Voice Note.webm'
}

export function pickMicMimeType(
  isTypeSupported: (type: string) => boolean
): string {
  for (const type of MIC_PREFERRED_MIME_TYPES) {
    if (isTypeSupported(type)) return type
  }
  return ''
}

export type MicSessionHostDeps = {
  getUserMedia: (constraints: MediaStreamConstraints) => Promise<MediaStream>
  MediaRecorder: typeof MediaRecorder | undefined
  now: () => number
  /** Live microphone level 0..1 while recording (for waveform UI). */
  onLevel?: (level: number) => void
}

type StartWaiter = {
  resolve: (requestId: number) => void
  reject: (err: MicSessionError) => void
}

type StopWaiter = {
  resolve: (result: MicSessionResult) => void
  reject: (err: MicSessionError) => void
}

type CancelWaiter = {
  resolve: () => void
}

type ActiveSession = {
  requestId: number
  state: MicSessionState
  cancelled: boolean
  stream: MediaStream | null
  recorder: MediaRecorder | null
  chunks: Blob[]
  startedAt: number
  mimeType: string
  startWaiter: StartWaiter | null
  stopWaiter: StopWaiter | null
  cancelWaiters: CancelWaiter[]
  settled: boolean
  stopAnalyser: (() => void) | null
}

function toError(err: unknown, fallbackName = 'Error'): MicSessionError {
  if (err && typeof err === 'object' && 'name' in err && 'message' in err) {
    const e = err as { name?: unknown; message?: unknown }
    return {
      name: typeof e.name === 'string' ? e.name : fallbackName,
      message: typeof e.message === 'string' ? e.message : String(err),
    }
  }
  return { name: fallbackName, message: String(err) }
}

function attachLevelMeter(
  stream: MediaStream,
  onLevel: (level: number) => void
): () => void {
  if (typeof window === 'undefined' || typeof AudioContext === 'undefined') {
    return () => {}
  }
  const AudioCtx =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext?: typeof AudioContext })
      .webkitAudioContext
  if (!AudioCtx) return () => {}

  let stopped = false
  let raf = 0
  const ctx = new AudioCtx()
  const source = ctx.createMediaStreamSource(stream)
  const analyser = ctx.createAnalyser()
  analyser.fftSize = 256
  analyser.smoothingTimeConstant = 0.7
  source.connect(analyser)
  const data = new Uint8Array(analyser.frequencyBinCount)

  const tick = () => {
    if (stopped) return
    analyser.getByteTimeDomainData(data)
    let sum = 0
    for (let i = 0; i < data.length; i++) {
      const v = (data[i] - 128) / 128
      sum += v * v
    }
    onLevel(Math.min(1, Math.sqrt(sum / data.length) * 3.2))
    raf = requestAnimationFrame(tick)
  }
  raf = requestAnimationFrame(tick)

  return () => {
    stopped = true
    cancelAnimationFrame(raf)
    try {
      source.disconnect()
      analyser.disconnect()
    } catch {
      /* ignore */
    }
    void ctx.close().catch(() => {})
  }
}

/**
 * Single-session microphone host: one active or requesting session at a time.
 */
export function createMicSessionHost(deps: MicSessionHostDeps) {
  let nextRequestId = 1
  let session: ActiveSession | null = null
  /** Waiters notified when the host becomes idle (no active session). */
  let idleWaiters: Array<() => void> = []
  /**
   * Monotonic generation for cancel→retry starts. Only the latest queued retry
   * proceeds after the cancelled permission wait settles — older ones abort.
   */
  let startQueueGeneration = 0

  const notifyIdle = () => {
    if (session && !session.settled) return
    const waiters = idleWaiters.slice()
    idleWaiters = []
    for (const waiter of waiters) waiter()
  }

  const waitUntilIdle = (): Promise<void> => {
    if (!session || session.settled) return Promise.resolve()
    return new Promise((resolve) => {
      idleWaiters.push(resolve)
    })
  }

  const stopTracks = (stream: MediaStream | null | undefined) => {
    if (!stream) return
    for (const track of stream.getTracks()) {
      try {
        track.stop()
      } catch {
        /* ignore */
      }
    }
  }

  const settle = (
    active: ActiveSession,
    options: {
      startReject?: MicSessionError
      startResolve?: number
      result?: MicSessionResult
    } = {}
  ) => {
    if (active.settled) return
    active.settled = true
    active.state = 'idle'

    const recorder = active.recorder
    if (recorder) {
      try {
        recorder.ondataavailable = null
        recorder.onerror = null
        recorder.onstart = null
        recorder.onstop = null
      } catch {
        /* ignore */
      }
    }

    stopTracks(active.stream)
    active.stream = null
    active.recorder = null
    active.chunks = []
    if (active.stopAnalyser) {
      try {
        active.stopAnalyser()
      } catch {
        /* ignore */
      }
      active.stopAnalyser = null
    }

    const startWaiter = active.startWaiter
    const stopWaiter = active.stopWaiter
    const cancelWaiters = active.cancelWaiters.slice()
    active.startWaiter = null
    active.stopWaiter = null
    active.cancelWaiters = []

    if (session === active) {
      session = null
    }
    notifyIdle()

    if (startWaiter) {
      if (options.startReject) {
        startWaiter.reject(options.startReject)
      } else if (options.startResolve !== undefined) {
        startWaiter.resolve(options.startResolve)
      } else {
        startWaiter.reject({
          name: 'AbortError',
          message: 'Microphone session ended before recording started',
        })
      }
    }

    for (const waiter of cancelWaiters) {
      waiter.resolve()
    }

    if (stopWaiter) {
      if (options.result) {
        stopWaiter.resolve(options.result)
      } else if (options.startReject) {
        stopWaiter.reject(options.startReject)
      } else {
        stopWaiter.resolve({ ok: false, cancelled: true })
      }
    }
  }

  const beginRecording = (active: ActiveSession, stream: MediaStream) => {
    if (active.cancelled || active.settled) {
      stopTracks(stream)
      settle(active, { result: { ok: false, cancelled: true } })
      return
    }

    const MR = deps.MediaRecorder
    if (typeof MR === 'undefined') {
      stopTracks(stream)
      const err: MicSessionError = {
        name: 'NotSupportedError',
        message: 'MediaRecorder is unavailable in this browser',
      }
      settle(active, { startReject: err, result: { ok: false, error: err } })
      return
    }

    const preferred = pickMicMimeType((t) => {
      try {
        return typeof MR.isTypeSupported === 'function' && MR.isTypeSupported(t)
      } catch {
        return false
      }
    })

    let recorder: MediaRecorder
    try {
      recorder = preferred
        ? new MR(stream, { mimeType: preferred })
        : new MR(stream)
    } catch (err) {
      stopTracks(stream)
      const e = toError(err, 'NotSupportedError')
      settle(active, { startReject: e, result: { ok: false, error: e } })
      return
    }

    const mimeType = recorder.mimeType || preferred || 'audio/webm'
    active.stream = stream
    active.recorder = recorder
    active.mimeType = mimeType
    active.chunks = []
    active.startedAt = deps.now()
    active.state = 'recording'
    if (deps.onLevel) {
      active.stopAnalyser = attachLevelMeter(stream, deps.onLevel)
    }

    recorder.ondataavailable = (e: BlobEvent) => {
      if (e.data && e.data.size > 0) {
        active.chunks.push(e.data)
      }
    }

    recorder.onerror = () => {
      if (active.settled) return
      const err: MicSessionError = {
        name: 'MediaRecorderError',
        message: 'MediaRecorder failed while recording',
      }
      try {
        if (recorder.state !== 'inactive') {
          active.cancelled = true
          ;(active as ActiveSession & { pendingError?: MicSessionError }).pendingError = err
          recorder.stop()
          return
        }
      } catch {
        /* fall through */
      }
      settle(active, { result: { ok: false, error: err } })
    }

    recorder.onstop = () => {
      if (active.settled) return

      const pendingError = (active as ActiveSession & { pendingError?: MicSessionError })
        .pendingError
      if (pendingError) {
        settle(active, { result: { ok: false, error: pendingError } })
        return
      }

      if (active.cancelled) {
        settle(active, { result: { ok: false, cancelled: true } })
        return
      }

      const elapsedMs = deps.now() - active.startedAt
      const durationSecs = micDurationSecs(elapsedMs)
      const type = active.mimeType || 'audio/webm'
      const blob = new Blob(active.chunks, { type })

      if (!blob.size) {
        const err: MicSessionError = {
          name: 'EmptyRecordingError',
          message: 'Recording produced no audio data',
        }
        settle(active, { result: { ok: false, error: err } })
        return
      }

      settle(active, {
        result: {
          ok: true,
          blob,
          mimeType: type,
          filename: micFilenameForMime(type),
          durationSecs,
        },
      })
    }

    try {
      recorder.start(200)
    } catch (err) {
      const e = toError(err, 'NotSupportedError')
      settle(active, { startReject: e, result: { ok: false, error: e } })
      return
    }

    const startWaiter = active.startWaiter
    active.startWaiter = null
    startWaiter?.resolve(active.requestId)
  }

  const start = (): Promise<number> => {
    if (session && !session.settled) {
      // Serialize cancel→retry: wait for the in-flight getUserMedia to settle
      // (tracks stopped) before opening another permission request. Never stack
      // concurrent getUserMedia calls — that floods permission prompts.
      if (session.cancelled && session.state === 'requesting') {
        const generation = ++startQueueGeneration
        return waitUntilIdle().then(() => {
          if (generation !== startQueueGeneration) {
            return Promise.reject({
              name: 'AbortError',
              message: 'Microphone request superseded',
            } satisfies MicSessionError)
          }
          return start()
        })
      }
      return Promise.reject({
        name: 'InvalidStateError',
        message: 'A microphone session is already active',
      } satisfies MicSessionError)
    }

    // A fresh start supersedes any still-queued cancel→retry waiters.
    startQueueGeneration += 1

    const requestId = nextRequestId++
    const active: ActiveSession = {
      requestId,
      state: 'requesting',
      cancelled: false,
      stream: null,
      recorder: null,
      chunks: [],
      startedAt: 0,
      mimeType: '',
      startWaiter: null,
      stopWaiter: null,
      cancelWaiters: [],
      settled: false,
      stopAnalyser: null,
    }
    session = active

    return new Promise<number>((resolve, reject) => {
      active.startWaiter = { resolve, reject }

      void deps
        .getUserMedia({ audio: true })
        .then((stream) => {
          if (active.cancelled || active.settled) {
            stopTracks(stream)
            settle(active, { result: { ok: false, cancelled: true } })
            return
          }
          beginRecording(active, stream)
        })
        .catch((err) => {
          if (active.settled) return
          const e = toError(err, 'NotAllowedError')
          settle(active, { startReject: e, result: { ok: false, error: e } })
        })
    })
  }

  const stop = (requestId: number): Promise<MicSessionResult> => {
    const active = session
    if (!active || active.requestId !== requestId || active.settled) {
      return Promise.reject({
        name: 'InvalidStateError',
        message: 'No matching microphone session',
      } satisfies MicSessionError)
    }
    if (active.stopWaiter) {
      return Promise.reject({
        name: 'InvalidStateError',
        message: 'Stop already in progress',
      } satisfies MicSessionError)
    }

    return new Promise<MicSessionResult>((resolve, reject) => {
      active.stopWaiter = { resolve, reject }

      if (active.state === 'requesting') {
        // Still waiting for permission — treat as cancel; drop stream when it arrives.
        active.cancelled = true
        if (active.startWaiter) {
          const startWaiter = active.startWaiter
          active.startWaiter = null
          startWaiter.reject({
            name: 'AbortError',
            message: 'Microphone request cancelled',
          })
        }
        // Session stays until getUserMedia settles so tracks can be stopped.
        return
      }

      if (active.state === 'recording' && active.recorder) {
        active.state = 'stopping'
        try {
          if (active.recorder.state !== 'inactive') {
            active.recorder.stop()
          } else {
            settle(active, { result: { ok: false, cancelled: true } })
          }
        } catch (err) {
          settle(active, { result: { ok: false, error: toError(err) } })
        }
        return
      }

      if (active.state === 'stopping') {
        return
      }

      settle(active, { result: { ok: false, cancelled: true } })
    })
  }

  const cancel = (requestId?: number): Promise<void> => {
    const active = session
    if (!active || active.settled) return Promise.resolve()
    if (requestId !== undefined && active.requestId !== requestId) {
      return Promise.resolve()
    }

    return new Promise<void>((resolve) => {
      active.cancelWaiters.push({ resolve })
      active.cancelled = true

      if (active.state === 'requesting') {
        if (active.startWaiter) {
          const startWaiter = active.startWaiter
          active.startWaiter = null
          startWaiter.reject({
            name: 'AbortError',
            message: 'Microphone request cancelled',
          })
        }
        // Resolve cancel immediately; keep session until getUserMedia returns so tracks stop.
        const waiters = active.cancelWaiters.slice()
        active.cancelWaiters = []
        for (const w of waiters) w.resolve()
        return
      }

      if (active.recorder && active.recorder.state !== 'inactive') {
        active.state = 'stopping'
        try {
          active.recorder.stop()
        } catch {
          settle(active, { result: { ok: false, cancelled: true } })
        }
        return
      }

      settle(active, { result: { ok: false, cancelled: true } })
    })
  }

  /** Abort any session immediately (navigation / unload). */
  const abortAll = (): void => {
    // Supersede queued cancel→retry starts so notifyIdle cannot revive them.
    startQueueGeneration += 1

    const active = session
    if (!active || active.settled) return
    active.cancelled = true

    if (active.recorder && active.recorder.state !== 'inactive') {
      try {
        active.recorder.stop()
      } catch {
        /* ignore */
      }
    }

    settle(active, {
      startReject: {
        name: 'AbortError',
        message: 'Microphone session aborted',
      },
      result: { ok: false, cancelled: true },
    })
  }

  const getState = (): MicSessionState => {
    if (!session || session.settled) return 'idle'
    return session.state
  }

  const getActiveRequestId = (): number | null => {
    if (!session || session.settled) return null
    return session.requestId
  }

  return {
    start,
    stop,
    cancel,
    abortAll,
    getState,
    getActiveRequestId,
  }
}
export type GuardedShellMicStart =
  | { status: 'started'; requestId: number }
  | { status: 'unsupported' }
  | { status: 'disposed' }

/**
 * Start a shell mic recording, cancelling the session if the caller was
 * disposed while the permission prompt was open - otherwise the mic stays on
 * with no owner.
 */
export async function startShellMicGuarded(deps: {
  ensureSupported: () => Promise<boolean>
  start: () => Promise<number>
  /** Fire-and-forget cancel of an orphaned shell session. */
  cancel: (requestId: number) => void
  isDisposed: () => boolean
}): Promise<GuardedShellMicStart> {
  const supported = await deps.ensureSupported()
  if (deps.isDisposed()) {
    return { status: 'disposed' }
  }
  if (!supported) {
    return { status: 'unsupported' }
  }

  const requestId = await deps.start()
  if (deps.isDisposed()) {
    deps.cancel(requestId)
    return { status: 'disposed' }
  }
  return { status: 'started', requestId }
}
