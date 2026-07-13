// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: Apache-2.0

const prefetched = new Set<string>()

export function prefetchUrl(url: string) {
  if (!url || prefetched.has(url)) return
  prefetched.add(url)
  const link = document.createElement('link')
  link.rel = 'prefetch'
  link.href = url
  link.as = 'document'
  document.head.appendChild(link)
}
