// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: Apache-2.0

import { describe, it, expect } from 'vitest'
import { markdownUrlTransform } from './markdown-url'

// Stands in for react-markdown's defaultUrlTransform: passes relative and safe
// absolute URLs through, blanks dangerous protocols.
function fallback(url: string): string {
  return /^(javascript|vbscript|file):/i.test(url.trim()) ? '' : url
}

const transform = markdownUrlTransform(fallback)

describe('markdownUrlTransform', () => {
  it('drops image sources on another origin', () => {
    // jsdom serves http://localhost:3000 by default.
    expect(transform('https://attacker.example/track.png', 'src')).toBe('')
    expect(transform('http://attacker.example/track.png', 'src')).toBe('')
  })

  it('drops protocol-relative image sources', () => {
    // "//host/x" inherits the page's scheme and is easy to mistake for a path.
    expect(transform('//attacker.example/track.png', 'src')).toBe('')
  })

  it('keeps images on this origin, however they are written', () => {
    expect(transform('attachments/abc', 'src')).toBe('attachments/abc')
    expect(transform('/wikis/x/-/attachments/abc', 'src')).toBe('/wikis/x/-/attachments/abc')
    expect(transform(`${window.location.origin}/avatar.png`, 'src')).toBe(
      `${window.location.origin}/avatar.png`
    )
  })

  it('keeps data: images, which issue no request', () => {
    const inline = 'data:image/png;base64,iVBORw0KGgo='
    expect(transform(inline, 'src')).toBe(inline)
  })

  it('leaves links alone, including external ones', () => {
    // Following a link is the reader's own act; only rendering is automatic.
    expect(transform('https://example.com/page', 'href')).toBe('https://example.com/page')
  })

  it('still applies the renderer’s protocol sanitising', () => {
    expect(transform('javascript:alert(1)', 'href')).toBe('')
    expect(transform('javascript:alert(1)', 'src')).toBe('')
  })

  it('drops an unparseable source rather than handing it to the browser', () => {
    expect(transform('http://[', 'src')).toBe('')
  })

  // Guards against this suite passing for the wrong reason. The renderer's own
  // sanitising has no opinion about a perfectly valid https: image, so if these
  // expectations ever hold without our transform, they are proving nothing.
  it('is not vacuous: the fallback alone would let the tracker through', () => {
    const tracker = 'https://attacker.example/track.png'
    expect(fallback(tracker)).toBe(tracker)
    expect(transform(tracker, 'src')).toBe('')
  })
})
