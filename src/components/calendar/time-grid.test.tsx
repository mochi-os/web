// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: Apache-2.0

import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { I18nProvider } from '@lingui/react'
import { i18n } from '@lingui/core'
import { TimeGrid } from './time-grid'

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
  render(
    <I18nProvider i18n={i18n}>
      <TimeGrid
        days={WEEK}
        events={[]}
        duration={60}
        hours={{ start: 8, finish: 17 }}
        workdays={[1, 2, 3, 4, 5]}
        today={today}
        onSelect={vi.fn()}
        onCreate={vi.fn()}
        onMove={vi.fn()}
        onDay={vi.fn()}
      />
    </I18nProvider>
  )
}

describe('TimeGrid', () => {
  it("fills today's column header in the primary colour with contrasting text", () => {
    show('2026-09-22')
    const header = screen.getByRole('button', { name: /22/ })
    expect(header.classList.contains('bg-primary')).toBe(true)
    expect(header.classList.contains('text-primary-foreground')).toBe(true)
  })

  it('leaves every other header unfilled', () => {
    show('2026-09-22')
    for (const name of [/21/, /23/, /24/, /25/, /26/, /27/]) {
      const header = screen.getByRole('button', { name })
      expect(header.classList.contains('bg-primary')).toBe(false)
    }
  })

  it('names each column with the weekday and the day on one line', () => {
    show('2026-09-22')
    const header = screen.getByRole('button', { name: /22/ })
    // One run of text, not a weekday stacked over a number, on a thin row.
    expect(header.children.length).toBe(0)
    expect(header.classList.contains('py-1')).toBe(true)
    expect(header.textContent).toMatch(/Tue/)
    expect(header.textContent).toMatch(/\b22\b/)
  })
})

describe('TimeGrid all-day band', () => {
  it('puts an all-day occurrence on its own date, not on the days its instants fall', () => {
    const start = Date.UTC(2026, 8, 21, 15) / 1000
    render(
      <I18nProvider i18n={i18n}>
        <TimeGrid
          days={WEEK}
          events={[
            {
              key: 'laundry',
              title: 'Laundry',
              colour: '#60a5fa',
              start,
              finish: start + 86400,
              allday: true,
              date: '2026-09-22',
            },
          ]}
          duration={60}
          hours={{ start: 8, finish: 17 }}
          workdays={[1, 2, 3, 4, 5]}
          today='2026-09-22'
          onSelect={vi.fn()}
          onCreate={vi.fn()}
          onMove={vi.fn()}
          onDay={vi.fn()}
        />
      </I18nProvider>
    )
    const bar = screen.getByRole('button', { name: /Laundry/ })
    // jsdom rounds the percentage; one column is 14.28…%, two would be 28.57…%.
    expect(bar.style.width).toMatch(/^calc\(14\.28\d*% - 2px\)$/)
    expect(bar.style.insetInlineStart).toMatch(/^14\.28\d*%$/)
  })
})
