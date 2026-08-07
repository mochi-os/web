// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: Apache-2.0

import { useEffect, useMemo, useRef } from 'react'

/**
 * Creates object URLs for image files and revokes them once they are no longer
 * displayed. Array index matches the input `files` array.
 *
 * URLs are minted during render, so callers have valid URLs in the same render
 * that files changed — no flash, no extra render cycle.
 *
 * A URL is keyed on the File itself, not on its position, so reordering the
 * list hands back the same URLs in a new order. Keying on the array reference
 * instead used to mint a fresh set on every change, which reloads every <img>
 * on the page; with drag-to-reorder that happens on every frame the pointer
 * crosses a slot.
 *
 * Revocation deliberately does NOT happen during render. It runs in an effect,
 * after the render that dropped a file has committed, so a URL the visible tree
 * is still pointing at can never be torn down underneath it. Revoking inline
 * would do exactly that whenever a render is abandoned, which concurrent
 * rendering makes ordinary as soon as a consumer adopts Suspense.
 *
 * The residue of minting during render is that an abandoned render leaks its
 * URLs until the page unloads. That is the mild half of the trade and the price
 * of having the URLs available synchronously.
 */
export function useImageObjectUrls(files: readonly File[]): (string | null)[] {
  const cacheRef = useRef(new Map<File, string>())

  const urls = useMemo(
    () =>
      files.map((file) => {
        if (!file.type.startsWith('image/')) return null
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
