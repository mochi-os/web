// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: Apache-2.0

import { useEffect, useMemo } from 'react'

/**
 * Creates object URLs for image files and revokes them once they are no longer
 * displayed. Array index matches the input `files` array.
 *
 * URLs are minted during render, keyed on the files array reference, so callers
 * have valid URLs in the same render that files changed — no flash, no extra
 * render cycle.
 *
 * Revocation deliberately does NOT happen during render. Effect cleanup runs
 * only after the replacement URLs have committed, so a URL the visible tree is
 * still pointing at can never be torn down underneath it. Revoking inline would
 * do exactly that whenever a render is abandoned, which concurrent rendering
 * makes ordinary as soon as a consumer adopts Suspense or a transition.
 *
 * The residue of minting during render is that an abandoned render leaks its
 * URLs until the page unloads. That is the mild half of the trade and the price
 * of having the URLs available synchronously.
 */
export function useImageObjectUrls(files: readonly File[]): (string | null)[] {
  const urls = useMemo(
    () =>
      files.map((file) =>
        file.type.startsWith('image/') ? URL.createObjectURL(file) : null
      ),
    [files]
  )

  useEffect(
    () => () => {
      urls.forEach((url) => {
        if (url) URL.revokeObjectURL(url)
      })
    },
    [urls]
  )

  return urls
}
