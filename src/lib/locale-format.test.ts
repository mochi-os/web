// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: Apache-2.0

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { i18n } from '@lingui/core'
import { formatDate, formatTime, formatRelativeTime } from './locale-format'

// A date whose month abbreviation differs visibly between languages.
const MARCH = new Date(2026, 2, 14, 15, 30, 0)

function load(locale: string, messages: Record<string, string> = {}) {
  i18n.load(locale, messages)
  i18n.activate(locale)
}

const original = i18n.locale
afterEach(() => {
  if (original) i18n.activate(original)
})

describe('month names follow the active language', () => {
  beforeEach(() => load('en'))

  it('uses English abbreviations under en', () => {
    expect(formatDate(MARCH, 'D MMM YYYY')).toBe('14 Mar 2026')
  })

  it('uses the language\'s own abbreviation, not English', () => {
    load('de')
    const german = formatDate(MARCH, 'D MMM YYYY')
    load('fr')
    const french = formatDate(MARCH, 'D MMM YYYY')
    load('ja')
    const japanese = formatDate(MARCH, 'D MMM YYYY')

    // The bug was a literal 'en' passed to toLocaleString, so every language
    // rendered the English abbreviation. Japanese is the clearest witness: it
    // has no Latin month abbreviation at all.
    expect(japanese).not.toContain('Mar')
    expect(japanese).toContain('3')
    expect(french).toContain('14')
    expect(french).toContain('2026')
    expect(german).toContain('2026')
  })

  it('leaves the numeric formats alone', () => {
    load('ja')
    expect(formatDate(MARCH, 'YYYY-MM-DD')).toBe('2026-03-14')
    expect(formatDate(MARCH, 'DD/MM/YYYY')).toBe('14/03/2026')
  })
})

describe('meridiem follows the active language', () => {
  it('is AM/PM under en', () => {
    load('en')
    expect(formatTime(MARCH, '12h')).toBe('3:30:00 PM')
  })

  it('is not the English marker under a language that uses its own', () => {
    load('ja')
    const japanese = formatTime(MARCH, '12h')
    // ja uses 午前/午後 rather than AM/PM.
    expect(japanese).not.toContain('PM')
    expect(japanese).toContain('午後')
  })

  it('does not touch 24h time, which has no marker', () => {
    load('ja')
    expect(formatTime(MARCH, '24h')).toBe('15:30:00')
  })
})

describe('relative-time units are translatable', () => {
  const now = () => Date.now() / 1000

  it('resolves each unit through the catalogue, not a bare literal', () => {
    load('en')
    // Asserted on the lookup rather than on a loaded translation: Lingui wants
    // compiled catalogues at runtime, so hand-loading ICU source here silently
    // falls back to the msgid and would pass whether or not the string was
    // ever wrapped. Spying on i18n._ shows the wrapping directly - under the
    // old code the units were bare template literals and never reached it.
    const seen: string[] = []
    const real = i18n._.bind(i18n)
    i18n._ = ((id: unknown, ...rest: unknown[]) => {
      // The macro compiles to a message descriptor, not positional arguments.
      seen.push(typeof id === 'string' ? id : String((id as { id?: string })?.id))
      // @ts-expect-error - forwarding to the real implementation
      return real(id, ...rest)
    }) as typeof i18n._

    try {
      formatRelativeTime(now() - 300, 'YYYY-MM-DD')
      formatRelativeTime(now() - 7200, 'YYYY-MM-DD')
      formatRelativeTime(now() - 172800, 'YYYY-MM-DD')
      formatRelativeTime(now() - 1209600, 'YYYY-MM-DD')
    } finally {
      i18n._ = real
    }

    // Four lookups, one per unit, all distinct. Under the old code the units
    // were bare template literals and there would be none. The id form itself
    // is not asserted: this config hashes ids while the app builds use the ICU
    // source, and pinning either would make the test a build-config detector.
    // That the app catalogues carry the four ICU msgids is verified by
    // extraction, not here.
    expect(seen).toHaveLength(4)
    expect(new Set(seen).size).toBe(4)
  })

  it('still renders the compact English form by default', () => {
    load('en')
    expect(formatRelativeTime(now() - 300, 'YYYY-MM-DD')).toBe('5m')
    expect(formatRelativeTime(now() - 7200, 'YYYY-MM-DD')).toBe('2h')
    expect(formatRelativeTime(now() - 172800, 'YYYY-MM-DD')).toBe('2d')
    expect(formatRelativeTime(now() - 1209600, 'YYYY-MM-DD')).toBe('2w')
  })

  it('keeps Just now and the absolute fallback', () => {
    load('en')
    expect(formatRelativeTime(now() - 10, 'YYYY-MM-DD')).toBe('Just now')
    // Older than a month falls through to an absolute date.
    expect(formatRelativeTime(now() - 5184000, 'YYYY-MM-DD')).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })
})
