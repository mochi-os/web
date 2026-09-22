// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: Apache-2.0

import { describe, it, expect, vi } from 'vitest'
import { render } from '@testing-library/react'
import { I18nProvider } from '@lingui/react'
import { i18n } from '@lingui/core'
import { MonthGrid } from './month-grid'

const WEEK = [
  '2026-09-21',
  '2026-09-22',
  '2026-09-23',
  '2026-09-24',
  '2026-09-25',
  '2026-09-26',
  '2026-09-27',
]

function show(today: string) {
  const { container } = render(
    <I18nProvider i18n={i18n}>
      <MonthGrid
        days={WEEK}
        month={9}
        events={[]}
        today={today}
        onSelect={vi.fn()}
        onCreate={vi.fn()}
        onMove={vi.fn()}
        onOverflow={vi.fn()}
        onDay={vi.fn()}
      />
    </I18nProvider>
  )
  return container
}

const cell = (container: HTMLElement, day: string) =>
  container.querySelector(`[data-day="${day}"]`) as HTMLElement

describe('MonthGrid', () => {
  it("puts today's number inside a band in the primary colour across its cell", () => {
    const today = cell(show('2026-09-22'), '2026-09-22')
    const number = today.querySelector('button') as HTMLElement
    const band = number.parentElement as HTMLElement
    expect(band.classList.contains('bg-primary')).toBe(true)
    expect(band.classList.contains('text-primary-foreground')).toBe(true)
    expect(number.classList.contains('bg-primary')).toBe(false)
  })

  it('draws no band on any other day', () => {
    const container = show('2026-09-22')
    for (const day of WEEK.filter((other) => other !== '2026-09-22')) {
      expect(cell(container, day).querySelector('.bg-primary')).toBeNull()
    }
  })
})
