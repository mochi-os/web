// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: Apache-2.0

// The hook is the seam between axios and the composers, so what is asserted
// here is the contract they rely on: slices appear only when the caller asked
// for them, the tiles never wait a frame for their first value, and the whole
// thing goes back to null however the request ends.

import { describe, it, expect } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import type { AxiosProgressEvent } from 'axios'
import { useUploadProgress } from './use-upload-progress'

type Emit = (event: AxiosProgressEvent) => void

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (error: unknown) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

/** Starts an upload and hands back the knobs to drive it from the test. */
function start(
  result: { current: ReturnType<typeof useUploadProgress> },
  sizes?: number[]
) {
  const request = deferred<string>()
  let emit!: Emit
  let settled!: Promise<string>

  act(() => {
    settled = result.current.upload(
      (onProgress) => {
        emit = onProgress
        return request.promise
      },
      sizes ? { sizes } : undefined
    )
    // The rejection case asserts on `settled` itself; this keeps the pending
    // promise from tripping an unhandled-rejection warning in the meantime.
    settled.catch(() => {})
  })

  return { request, emit: (e: AxiosProgressEvent) => act(() => emit(e)), settled }
}

const event = (loaded: number, total?: number) =>
  ({ loaded, total }) as AxiosProgressEvent

describe('useUploadProgress', () => {
  it('reports nothing while idle', () => {
    const { result } = renderHook(() => useUploadProgress())
    expect(result.current.progress).toBeNull()
  })

  // The tiles are already on screen when the request starts, so an undefined
  // first value would make every fill pop in a frame late. The seed comes from
  // the same derivation as every later value, so the first file reads as on the
  // wire rather than queued behind nothing.
  it('seeds from the derivation before the first progress event', async () => {
    const { result } = renderHook(() => useUploadProgress())
    const { request, settled } = start(result, [1000, 3000])

    expect(result.current.progress?.slices).toEqual([
      { fraction: 0, state: 'uploading' },
      { fraction: 0, state: 'waiting' },
    ])

    request.resolve('done')
    await act(async () => {
      await settled
    })
  })

  // Every file empty leaves nothing to derive from, and the seed must not
  // invent slices the derivation would refuse to produce.
  it('seeds nothing when every file is empty', async () => {
    const { result } = renderHook(() => useUploadProgress())
    const { request, settled } = start(result, [0, 0])

    expect(result.current.progress?.slices).toBeUndefined()

    request.resolve('done')
    await act(async () => {
      await settled
    })
  })

  it('splits the counter across the files', async () => {
    const { result } = renderHook(() => useUploadProgress())
    const { request, emit, settled } = start(result, [1000, 3000])

    emit(event(2000, 4000))

    const slices = result.current.progress?.slices
    expect(slices?.map((s) => s.state)).toEqual(['sent', 'uploading'])
    expect(slices?.[1].fraction).toBeCloseTo(1 / 3, 6)
    expect(result.current.progress?.phase).toBe('uploading')

    request.resolve('done')
    await act(async () => {
      await settled
    })
  })

  it('flips to processing with every file sent once the body is out', async () => {
    const { result } = renderHook(() => useUploadProgress())
    const { request, emit, settled } = start(result, [1000, 3000])

    emit(event(4000, 4000))

    expect(result.current.progress?.phase).toBe('processing')
    expect(result.current.progress?.slices?.every((s) => s.state === 'sent')).toBe(
      true
    )

    request.resolve('done')
    await act(async () => {
      await settled
    })
  })

  // The ~20 call sites that predate per-file progress pass no sizes and must
  // keep behaving exactly as they did.
  it('stays on the aggregate counter when no sizes are given', async () => {
    const { result } = renderHook(() => useUploadProgress())
    const { request, emit, settled } = start(result)

    emit(event(2000, 4000))

    expect(result.current.progress?.sent).toBe(2000)
    expect(result.current.progress?.total).toBe(4000)
    expect(result.current.progress?.slices).toBeUndefined()

    request.resolve('done')
    await act(async () => {
      await settled
    })
  })

  it('drops the slices when the body size is unknown', async () => {
    const { result } = renderHook(() => useUploadProgress())
    const { request, emit, settled } = start(result, [1000, 3000])

    emit(event(2000, undefined))

    expect(result.current.progress?.total).toBeNull()
    expect(result.current.progress?.slices).toBeUndefined()

    request.resolve('done')
    await act(async () => {
      await settled
    })
  })

  it('clears on success', async () => {
    const { result } = renderHook(() => useUploadProgress())
    const { request, emit, settled } = start(result, [1000])

    emit(event(500, 1000))
    expect(result.current.progress).not.toBeNull()

    request.resolve('done')
    await act(async () => {
      await settled
    })

    expect(result.current.progress).toBeNull()
  })

  // A failed send leaves the composer holding its files for a retry, so a bar
  // frozen at 60% underneath them would read as still running.
  it('clears on failure and rethrows', async () => {
    const { result } = renderHook(() => useUploadProgress())
    const { request, emit, settled } = start(result, [1000])

    emit(event(600, 1000))
    request.reject(new Error('network'))

    await act(async () => {
      await expect(settled).rejects.toThrow('network')
    })

    expect(result.current.progress).toBeNull()
  })

  // The sizes live in a ref for the life of the request; a second upload from
  // the same hook has to pick up its own, not the previous one's.
  it('uses the sizes of the current upload, not the last one', async () => {
    const { result } = renderHook(() => useUploadProgress())

    const first = start(result, [1000, 3000])
    first.request.resolve('done')
    await act(async () => {
      await first.settled
    })

    const second = start(result, [500])
    second.emit(event(250, 500))

    expect(result.current.progress?.slices).toHaveLength(1)
    expect(result.current.progress?.slices?.[0].fraction).toBeCloseTo(0.5, 6)

    second.request.resolve('done')
    await act(async () => {
      await second.settled
    })
  })
})
