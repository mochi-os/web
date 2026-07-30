// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: Apache-2.0

import { useCallback, useState } from 'react'
import type { AxiosProgressEvent } from 'axios'

export interface Upload {
  sent: number
  total: number | null
  phase: 'uploading' | 'processing'
}

/**
 * Tracks the byte progress of a single in-flight upload. `upload` wraps an
 * API call, handing it an axios `onUploadProgress` callback to thread into
 * the request config; `progress` is null when idle, then {sent, total, phase}
 * while the request runs. Once the body has fully left the browser the phase
 * flips to 'processing' — the server is still generating thumbnails or
 * fanning out, and a bar parked at 100% would read as stuck.
 */
export function useUploadProgress() {
  const [progress, setProgress] = useState<Upload | null>(null)

  const track = useCallback((event: AxiosProgressEvent) => {
    const total = event.total ?? null
    const sent = event.loaded
    setProgress({
      sent,
      total,
      phase: total != null && sent >= total ? 'processing' : 'uploading',
    })
  }, [])

  const upload = useCallback(
    async <Result,>(
      request: (onProgress: (event: AxiosProgressEvent) => void) => Promise<Result>
    ): Promise<Result> => {
      setProgress({ sent: 0, total: null, phase: 'uploading' })
      try {
        return await request(track)
      } finally {
        setProgress(null)
      }
    },
    [track]
  )

  return { progress, upload }
}
