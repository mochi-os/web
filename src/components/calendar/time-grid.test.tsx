// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: Apache-2.0

import { describe, it, expect, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { I18nProvider } from '@lingui/react'
import { i18n } from '@lingui/core'
import { TimeGrid } from './time-grid'
import type { CalendarEvent } from './types'

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

// The user's zone in these tests is the provider default, UTC.
describe('TimeGrid zones', () => {
  const DAYS = ['2026-09-25', '2026-09-26', '2026-09-27', '2026-09-28']
  function grid(events: CalendarEvent[]) {
    render(
      <I18nProvider i18n={i18n}>
        <TimeGrid
          days={DAYS}
          events={events}
          duration={60}
          hours={{ start: 8, finish: 17 }}
          workdays={[1, 2, 3, 4, 5]}
          today='2026-09-25'
          onSelect={vi.fn()}
          onCreate={vi.fn()}
          onMove={vi.fn()}
          onDay={vi.fn()}
        />
      </I18nProvider>
    )
  }
  // 10:00 London (BST) to 13:00 New York (EDT): 09:00Z to 17:00Z, eight hours.
  const flight = {
    key: 'flight',
    title: 'Flight',
    colour: '#60a5fa',
    start: Date.UTC(2026, 8, 25, 9) / 1000,
    finish: Date.UTC(2026, 8, 25, 17) / 1000,
    allday: false,
  }

  it('places an occurrence by its instants in the user zone when it carries no zones', () => {
    grid([flight])
    const block = screen.getByRole('button', { name: /Flight/ })
    expect(block.style.top).toBe(`${9 * 80}px`)
    expect(block.style.height).toBe(`${8 * 80 - 1}px`)
  })

  it('places each end at its wall-clock time in its own zone', () => {
    grid([{ ...flight, zone: { start: 'Europe/London', finish: 'America/New_York' } }])
    const block = screen.getByRole('button', { name: /Flight/ })
    expect(block.style.top).toBe(`${10 * 80}px`)
    expect(block.style.height).toBe(`${3 * 80 - 1}px`)
  })

  it('draws an end that falls before its start at minimum height with a glyph', () => {
    // Monday 10:00 in Auckland (NZDT) is Sunday 21:00Z; four hours later is
    // Sunday 15:00 in Tahiti, the day before by the clock.
    grid([
      {
        key: 'hop',
        title: 'Hop',
        colour: '#60a5fa',
        start: Date.UTC(2026, 8, 27, 21) / 1000,
        finish: Date.UTC(2026, 8, 28, 1) / 1000,
        allday: false,
        zone: { start: 'Pacific/Auckland', finish: 'Pacific/Tahiti' },
      },
    ])
    const block = screen.getByRole('button', { name: /Hop/ })
    expect(block.style.top).toBe(`${10 * 80}px`)
    expect(block.style.height).toBe('24px')
    expect(screen.getByLabelText('Ends before it starts')).toBeTruthy()
    // On the start day only: the grid holds one block for it.
    expect(screen.getAllByRole('button', { name: /Hop/ })).toHaveLength(1)
  })

  it('reads the clock on the block in the start zone', () => {
    // 13:00Z is 09:00 in New York.
    const meeting = {
      key: 'meeting',
      title: 'Meeting',
      colour: '#60a5fa',
      start: Date.UTC(2026, 8, 25, 13) / 1000,
      finish: Date.UTC(2026, 8, 25, 14) / 1000,
      allday: false,
    }
    grid([meeting])
    expect(screen.getByRole('button', { name: /Meeting/ }).textContent).toContain('13:00')
    cleanup()
    grid([{ ...meeting, zone: { start: 'America/New_York', finish: 'America/New_York' } }])
    expect(screen.getByRole('button', { name: /Meeting/ }).textContent).toContain('09:00')
  })
})

describe('TimeGrid gutter zone', () => {
  function grid(zone?: string) {
    render(
      <I18nProvider i18n={i18n}>
        <TimeGrid
          days={WEEK}
          events={[]}
          duration={60}
          hours={{ start: 8, finish: 17 }}
          workdays={[1, 2, 3, 4, 5]}
          today='2026-09-22'
          zone={zone}
          onSelect={vi.fn()}
          onCreate={vi.fn()}
          onMove={vi.fn()}
          onDay={vi.fn()}
        />
      </I18nProvider>
    )
  }
  it('labels the gutter with the zone it reads in when given one', () => {
    grid('UTC+1')
    expect(screen.getByTestId('gutter-zone').textContent).toBe('UTC+1')
  })
  it('shows no label otherwise', () => {
    grid()
    expect(screen.queryByTestId('gutter-zone')).toBeNull()
  })
})

