// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: Apache-2.0

import { useCallback, useRef, useState } from 'react'
import type { AxiosProgressEvent } from 'axios'
import { uploadSlices, type UploadSlice } from '../lib/upload-slices'

export interface Upload {
  sent: number
  total: number | null
  phase: 'uploading' | 'processing'
  /**
   * Per-file progress, in the order the files were appended to the body.
   * Present only when `upload` was given their sizes; see `uploadSlices`.
   */
  slices?: UploadSlice[]
}

export interface UploadOptions {
  /**
   * Byte size of each file in the request, in body order. Supply this to get
   * `slices` back. It must line up with the array that actually goes into the
   * FormData, which is not always the array a composer is showing.
   */
  sizes?: readonly number[]
}

/**
 * Tracks the byte progress of a single in-flight upload. `upload` wraps an
 * API call, handing it an axios `onUploadProgress` callback to thread into
 * the request config; `progress` is null when idle, then {sent, total, phase}
 * while the request runs. Once the body has fully left the browser the phase
 * flips to 'processing' — the server is still generating thumbnails or
 * fanning out, and a bar parked at 100% would read as stuck.
 *
 * Pass `sizes` to also get `slices`, which splits that one counter across the
 * individual files. There is only ever one request, so this is derived rather
 * than measured; `uploadSlices` documents what that costs.
 */
export function useUploadProgress() {
  const [progress, setProgress] = useState<Upload | null>(null)
  // Read inside `track`, which axios keeps for the life of the request, so it
  // has to be a ref — a state value would be the one captured at call time.
  const sizesRef = useRef<readonly number[] | undefined>(undefined)

  const track = useCallback((event: AxiosProgressEvent) => {
    const total = event.total ?? null
    const sent = event.loaded
    const sizes = sizesRef.current
    setProgress({
      sent,
      total,
      phase: total != null && sent >= total ? 'processing' : 'uploading',
      slices: sizes ? (uploadSlices(sent, total, sizes) ?? undefined) : undefined,
    })
  }, [])

  const upload = useCallback(
    async <Result,>(
      request: (onProgress: (event: AxiosProgressEvent) => void) => Promise<Result>,
      options?: UploadOptions
    ): Promise<Result> => {
      sizesRef.current = options?.sizes
      setProgress({
        sent: 0,
        total: null,
        phase: 'uploading',
        // Before the first progress event there is no body size to scale
        // against, so every file starts at zero rather than unknown — the tiles
        // are already on screen and must not pop in a frame late.
        slices: options?.sizes?.map(() => ({
          fraction: 0,
          state: 'waiting' as const,
        })),
      })
      try {
        return await request(track)
      } finally {
        sizesRef.current = undefined
        setProgress(null)
      }
    },
    [track]
  )

  return { progress, upload }
}
