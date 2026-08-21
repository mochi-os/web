// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: Apache-2.0

import { useEffect, useMemo, useRef } from 'react'
import { isMedia } from '../lib/attachment-utils'

/**
 * Object URLs for image and video files, revoked when no longer displayed.
 * Keyed on the File, not its position, so reordering does not remint. Revoked
 * in an effect, never during render: a committed tree may still point at the
 * URL.
 */
export function useImageObjectUrls(files: readonly File[]): (string | null)[] {
  const cacheRef = useRef(new Map<File, string>())

  const urls = useMemo(
    () =>
      files.map((file) => {
        if (!isMedia(file.type)) return null
        const cached = cacheRef.current.get(file)
        if (cached) return cached
        const url = URL.createObjectURL(file)
        cacheRef.current.set(file, url)
        return url
      }),
    [files]
  )

  useEffect(() => {
    const cache = cacheRef.current
    const shown = new Set(files)
    cache.forEach((url, file) => {
      if (shown.has(file)) return
      URL.revokeObjectURL(url)
      cache.delete(file)
    })
  }, [files, urls])

  // Separate from the sweep above: that one runs on every change and must only
  // let go of files that left, while this one is the teardown for the rest.
  useEffect(() => {
    const cache = cacheRef.current
    return () => {
      cache.forEach((url) => URL.revokeObjectURL(url))
      cache.clear()
    }
  }, [])

  return urls
}
