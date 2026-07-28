// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: Apache-2.0

// URL policy for rendered Markdown.
//
// Markdown is written by whoever authored the document - a stranger whose
// friend request has not been accepted, a member of a wiki anyone can read - so
// an image it references is a request the reader's browser makes to a server
// the author chose, disclosing an IP address, a timestamp and browser metadata
// before the reader has decided to trust anybody. Images are therefore limited
// to this origin. Links are deliberately left alone: following one is the
// reader's own act, not a side effect of the page rendering.

// Whether a URL would load from somewhere other than this app's own origin.
function foreign(url: string): boolean {
  const value = url.trim()
  // data: renders inline and issues no request, so it discloses nothing.
  if (/^data:/i.test(value)) return false
  try {
    // Both origins are derived from location.href rather than read from
    // location.origin. Authenticated apps run inside the shell's sandboxed
    // iframe, which has an opaque origin where location.origin is the string
    // "null" - comparing against that would classify every relative URL,
    // including the app's own attachments, as foreign and blank them all.
    const base = new URL(window.location.href)
    return new URL(value, base).origin !== base.origin
  } catch {
    // An unparseable URL is not something to hand to the browser.
    return true
  }
}

// Build a urlTransform for react-markdown that drops foreign image sources.
// `fallback` is the renderer's own transform, applied to everything else so its
// protocol sanitising still runs - pass react-markdown's defaultUrlTransform.
// It is supplied by the caller rather than imported here so that lib/web does
// not take a dependency on react-markdown for the two apps that render Markdown.
export function markdownUrlTransform(
  fallback: (url: string) => string
): (url: string, key: string) => string {
  return (url: string, key: string) => {
    if (key === 'src' && foreign(url)) return ''
    return fallback(url)
  }
}
