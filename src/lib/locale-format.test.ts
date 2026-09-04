// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: Apache-2.0

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { i18n } from '@lingui/core'
import { formatDate, formatTime, formatDateTime, formatRelativeTime, formatUserTimestamp } from './locale-format'

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
    // Spying on i18n._ rather than asserting on output: hand-loaded ICU source
    // falls back to the msgid, so the assertion would pass unwrapped either
    // way.
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

    // Four lookups, one per unit, all distinct. The id form is not asserted:
    // this config hashes ids while the app builds use the ICU source, so
    // pinning either would make the test a build-config detector.
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

describe('the timezone preference reaches the rendered value', () => {
  beforeEach(() => load('en'))

  // A fixed instant, so the assertions below do not depend on the machine's
  // own zone: 2026-03-14T15:30:00Z.
  const INSTANT = new Date(Date.UTC(2026, 2, 14, 15, 30, 0))

  it('renders the same instant differently either side of the world', () => {
    expect(formatTime(INSTANT, '24h', 'UTC')).toBe('15:30:00')
    expect(formatTime(INSTANT, '24h', 'Asia/Tokyo')).toBe('00:30:00')
    expect(formatTime(INSTANT, '24h', 'America/Los_Angeles')).toBe('08:30:00')
  })

  it('rolls the date over when the zone crosses midnight', () => {
    expect(formatDate(INSTANT, 'YYYY-MM-DD', 'UTC')).toBe('2026-03-14')
    // Tokyo is already the next day at 15:30Z.
    expect(formatDate(INSTANT, 'YYYY-MM-DD', 'Asia/Tokyo')).toBe('2026-03-15')
  })

  it('applies the zone to the 12-hour clock and its meridiem', () => {
    expect(formatTime(INSTANT, '12h', 'UTC')).toBe('3:30:00 PM')
    expect(formatTime(INSTANT, '12h', 'Asia/Tokyo')).toBe('12:30:00 AM')
  })

  it('applies the zone to the month name form', () => {
    expect(formatDate(INSTANT, 'D MMM YYYY', 'Asia/Tokyo')).toBe('15 Mar 2026')
  })

  it('combines both halves in formatDateTime', () => {
    expect(formatDateTime(INSTANT, 'YYYY-MM-DD', '24h', 'Asia/Tokyo')).toBe('2026-03-15 00:30:00')
  })

  it('falls back to local time when the zone is absent or unusable', () => {
    // No preference: identical to the plain Date getters, which is what every
    // existing caller relied on before the parameter existed.
    const local = new Date(2026, 2, 14, 15, 30, 0)
    expect(formatTime(local, '24h')).toBe('15:30:00')
    expect(formatDate(local, 'YYYY-MM-DD')).toBe('2026-03-14')
    // A zone Intl rejects must degrade rather than throw inside a render.
    expect(formatTime(local, '24h', 'Not/AZone')).toBe('15:30:00')
    expect(formatDate(local, 'YYYY-MM-DD', 'Not/AZone')).toBe('2026-03-14')
    // The month-name and meridiem forms build their own Intl formatters,
    // which used to throw where the numeric forms already degraded.
    expect(formatDate(local, 'D MMM YYYY', 'Not/AZone')).toBe('14 Mar 2026')
    expect(formatTime(local, '12h', 'Not/AZone')).toBe('3:30:00 PM')
  })
})

// The preference object carries the zone, but two of the three display modes
// dropped it on the floor: an absolute timestamp, and the date a relative
// timestamp falls back to after a month, both rendered in the machine's zone.
describe('the timezone preference reaches every timestamp display', () => {
  beforeEach(() => load('en'))

  // 2026-03-14T15:30:00Z as a Unix timestamp.
  const INSTANT = Date.UTC(2026, 2, 14, 15, 30, 0) / 1000
  const preferences = (timestampDisplay: 'absolute' | 'relative' | 'auto', timezone: string) => ({
    dateFormat: 'YYYY-MM-DD' as const,
    timeFormat: '24h' as const,
    timestampDisplay,
    timezone,
  })

  it('renders an absolute timestamp in the preferred zone', () => {
    expect(formatUserTimestamp(INSTANT, preferences('absolute', 'UTC'))).toBe('2026-03-14 15:30:00')
    expect(formatUserTimestamp(INSTANT, preferences('absolute', 'Asia/Tokyo'))).toBe('2026-03-15 00:30:00')
  })

  it('renders the date a relative timestamp falls back to in the preferred zone', () => {
    // Older than the thirty-day relative window in every zone, so the branch
    // under test is the absolute-date fallback.
    expect(formatRelativeTime(INSTANT, 'YYYY-MM-DD', 'UTC')).toBe('2026-03-14')
    expect(formatRelativeTime(INSTANT, 'YYYY-MM-DD', 'Asia/Tokyo')).toBe('2026-03-15')
    expect(formatUserTimestamp(INSTANT, preferences('relative', 'Asia/Tokyo'))).toBe('2026-03-15')
  })
})
