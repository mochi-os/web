// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: Apache-2.0

// URL policy for rendered Markdown. Images are limited to this origin: the
// author chooses the server, and fetching from it discloses the reader's IP and
// browser metadata. Links are left alone - following one is the reader's own
// act.

// Whether a URL would load from somewhere other than this app's own origin.
function foreign(url: string): boolean {
  const value = url.trim()
  // data: renders inline and issues no request, so it discloses nothing.
  if (/^data:/i.test(value)) return false
  try {
    // location.href rather than location.origin, purely because a URL object
    // is wanted as the resolution base anyway. Both read the real origin inside
    // the shell's sandboxed iframe - safe-navigation.ts compares against
    // location.origin to gate the Authorization header on every request, and
    // that works, which is the standing proof.
    const base = new URL(window.location.href)
    return new URL(value, base).origin !== base.origin
  } catch {
    // An unparseable URL is not something to hand to the browser.
    return true
  }
}

// Build a urlTransform for react-markdown that drops foreign image sources.
// `fallback` is the renderer's own transform (pass defaultUrlTransform),
// supplied by the caller so lib/web takes no dependency on react-markdown.
export function markdownUrlTransform(
  fallback: (url: string) => string
): (url: string, key: string) => string {
  return (url: string, key: string) => {
    if (key === 'src' && foreign(url)) return ''
    return fallback(url)
  }
}
