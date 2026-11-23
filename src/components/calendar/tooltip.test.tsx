// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: Apache-2.0

import type { ReactNode } from 'react'
import { afterEach, describe, it, expect, vi } from 'vitest'
import { renderHook } from '@testing-library/react'
import { I18nProvider } from '@lingui/react'
import { i18n } from '@lingui/core'
import { useEventTooltip } from './tooltip'

// The user's zone; the provider's default is UTC.
let zone: string | undefined

vi.mock('../../context/locale-provider', async (importOriginal) => {
  const original =
    await importOriginal<typeof import('../../context/locale-provider')>()
  return {
    ...original,
    useLocale: () => {
      const value = original.useLocale()
      return zone
        ? { ...value, locale: { ...value.locale, timezone: zone } }
        : value
    },
  }
})

afterEach(() => {
  zone = undefined
})

const wrapper = ({ children }: { children: ReactNode }) => (
  <I18nProvider i18n={i18n}>{children}</I18nProvider>
)

const noon = Date.UTC(2026, 8, 25, 12) / 1000

describe('useEventTooltip', () => {
  it('reads an HTML description as text, with its line breaks', () => {
    const { result } = renderHook(() => useEventTooltip(), { wrapper })
    const text = result.current({
      key: 'e1',
      title: 'DUB:2-DEN 15:25-18:15',
      colour: '#60a5fa',
      start: noon,
      finish: noon + 3600,
      allday: false,
      location: 'EI59',
      description: 'PNR: 2YHEIJ&nbsp;<br>Class: Business<br>Seats: 2K',
    })
    expect(text).toContain('PNR: 2YHEIJ\nClass: Business\nSeats: 2K')
    expect(text).not.toContain('<br>')
    expect(text).not.toContain('&nbsp;')
  })

  it('leaves a plain description as it is', () => {
    const { result } = renderHook(() => useEventTooltip(), { wrapper })
    const text = result.current({
      key: 'e2',
      title: 'Budget call',
      colour: '#60a5fa',
      start: noon,
      finish: noon + 3600,
      allday: false,
      description: 'Bring the numbers\na < b',
    })
    expect(text).toContain('Bring the numbers\na < b')
  })

  it('names an untitled event, and says when it is cancelled or tentative', () => {
    const { result } = renderHook(() => useEventTooltip(), { wrapper })
    const base = {
      key: 'e3',
      title: '',
      colour: '#60a5fa',
      start: noon,
      finish: noon + 3600,
      allday: false,
    }
    const [first, second] = result
      .current({ ...base, status: 'cancelled' })
      .split('\n')
    expect(first).toBe('(No title)')
    expect(second).toBe('Cancelled')
    expect(result.current({ ...base, status: 'tentative' })).toContain(
      '\nTentative\n'
    )
    expect(result.current(base).split('\n')).toHaveLength(2)
  })

  // A birthday is laid from midnight to midnight in UTC, on its own date.
  const birthday = {
    key: 'birthday-c1',
    title: 'Ada',
    colour: '#f97316',
    start: Date.UTC(2026, 10, 17) / 1000,
    finish: Date.UTC(2026, 10, 18) / 1000,
    allday: true,
    date: '2026-11-17',
  }

  it('names the one day of an all-day occurrence west of the zone it was laid in', () => {
    zone = 'America/Los_Angeles'
    const { result } = renderHook(() => useEventTooltip(), { wrapper })
    expect(result.current(birthday).split('\n')[1]).toBe(
      'Tuesday, November 17, 2026'
    )
  })

  it('names the one day of an all-day occurrence east of the zone it was laid in', () => {
    zone = 'Asia/Tokyo'
    const { result } = renderHook(() => useEventTooltip(), { wrapper })
    expect(result.current(birthday).split('\n')[1]).toBe(
      'Tuesday, November 17, 2026'
    )
  })

  it('names every day of a longer all-day occurrence by its date', () => {
    zone = 'America/Los_Angeles'
    const { result } = renderHook(() => useEventTooltip(), { wrapper })
    const span = result
      .current({ ...birthday, finish: birthday.finish + 2 * 86400 })
      .split('\n')[1]
    expect(span).toMatch(/\b17\b/)
    expect(span).toMatch(/\b19\b/)
    expect(span).not.toMatch(/\b16\b/)
    expect(span).not.toMatch(/\b20\b/)
  })

  it('reads a timed occurrence in its own zone, as its block is labelled', () => {
    // 01:00 to 02:00 on the 24th in Tokyo, the 23rd in the user's UTC.
    const { result } = renderHook(() => useEventTooltip(), { wrapper })
    const text = result.current({
      key: 'e4',
      title: 'Tokyo call',
      colour: '#60a5fa',
      start: Date.UTC(2026, 8, 23, 16) / 1000,
      finish: Date.UTC(2026, 8, 23, 17) / 1000,
      allday: false,
      zone: { start: 'Asia/Tokyo', finish: 'Asia/Tokyo' },
    })
    expect(text.split('\n')[1]).toBe(
      'Thursday, September 24, 2026, 01:00 to 02:00'
    )
  })
})
