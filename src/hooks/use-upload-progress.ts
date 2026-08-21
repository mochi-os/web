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
   * Byte size of each file, in body order; supply it to get `slices` back. Must
   * line up with the array that goes into the FormData, not the one on screen.
   */
  sizes?: readonly number[]
}

/**
 * Byte progress of a single in-flight upload. The phase flips to 'processing'
 * once the body has left the browser, so a bar does not park at 100%. Pass
 * `sizes` for per-file `slices`; see `uploadSlices`.
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
      const sizes = options?.sizes
      sizesRef.current = sizes
      // Seed the zero state from the same function that produces every later
      // value, scaled against the payload since the body size is not known
      // until the first event.
      const payload = sizes?.reduce((a, b) => a + b, 0) ?? 0
      setProgress({
        sent: 0,
        total: null,
        phase: 'uploading',
        slices: sizes ? (uploadSlices(0, payload, sizes) ?? undefined) : undefined,
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
