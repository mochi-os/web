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
    grid([
      {
        ...flight,
        zone: { start: 'Europe/London', finish: 'America/New_York' },
      },
    ])
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
    expect(
      screen.getByRole('button', { name: /Meeting/ }).textContent
    ).toContain('13:00')
    cleanup()
    grid([
      {
        ...meeting,
        zone: { start: 'America/New_York', finish: 'America/New_York' },
      },
    ])
    expect(
      screen.getByRole('button', { name: /Meeting/ }).textContent
    ).toContain('09:00')
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

describe('TimeGrid event appearance', () => {
  const at = (day: number, hour: number) => Date.UTC(2026, 8, day, hour) / 1000
  const events: CalendarEvent[] = [
    {
      key: 'standup',
      title: 'Standup',
      colour: '#60a5fa',
      start: at(23, 9),
      finish: at(23, 10),
      allday: false,
      location: 'Room 4',
    },
    {
      key: 'weekly',
      title: 'Weekly',
      colour: '#a855f7',
      start: at(24, 11),
      finish: at(24, 12),
      allday: false,
      recurring: true,
      alarm: true,
    },
    {
      key: 'earlier',
      title: 'Earlier',
      colour: '#f97316',
      start: at(21, 9),
      finish: at(21, 10),
      allday: false,
    },
    {
      key: 'holiday',
      title: 'Holiday',
      colour: '#22c55e',
      start: at(24, 0),
      finish: at(25, 0),
      allday: true,
      date: '2026-09-24',
    },
  ]

  function draw() {
    vi.useFakeTimers({
      now: new Date(Date.UTC(2026, 8, 22, 12)),
      toFake: ['Date'],
    })
    const { container } = render(
      <I18nProvider i18n={i18n}>
        <TimeGrid
          days={WEEK}
          events={events}
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
    vi.useRealTimers()
    return (key: string) =>
      container.querySelector(`[data-key="${key}"]`) as HTMLElement
  }

  it('reads a week block as its dot and title, with its time on a line under the title, on a neutral card', () => {
    cleanup()
    const block = draw()('standup')
    const [first, second] = Array.from(block.children) as HTMLElement[]
    const dot = first.firstElementChild as HTMLElement
    expect(dot.classList.contains('rounded-full')).toBe(true)
    expect(dot.style.backgroundColor).toBe('rgb(96, 165, 250)')
    expect(first.textContent).toBe('Standup')
    expect(second.textContent).toMatch(/^\d{1,2}:\d{2}/)
    expect(second.classList.contains('ps-3.5')).toBe(true)
    expect(block.style.borderInlineStartColor).toBe('')
    expect(block.style.backgroundColor).toBe('')
    expect(block.classList.contains('bg-surface-2')).toBe(true)
  })

  it('draws an all-day bar as its dot and its title, with no time', () => {
    cleanup()
    const bar = draw()('holiday')
    expect((bar.firstElementChild as HTMLElement).style.backgroundColor).toBe(
      'rgb(34, 197, 94)'
    )
    expect(bar.textContent).toBe('Holiday')
  })

  it('draws a block that is over quieter than one still to come', () => {
    cleanup()
    const find = draw()
    expect(find('earlier').classList.contains('opacity-60')).toBe(true)
    expect(find('standup').classList.contains('opacity-60')).toBe(false)
  })

  it('puts the time, then the repeat mark, then the reminder under the title', () => {
    cleanup()
    const block = draw()('weekly')
    const parts = Array.from(block.children[1].children) as HTMLElement[]
    expect(parts[0].textContent).toMatch(/^\d{1,2}:\d{2}/)
    expect(parts[1].getAttribute('aria-label')).toBe('Repeats')
    expect(parts[2].getAttribute('aria-label')).toBe('Reminder')
  })

  it('keeps a single day on one line: title, reminder, repeat mark, then the time at the end', () => {
    cleanup()
    const { container } = render(
      <I18nProvider i18n={i18n}>
        <TimeGrid
          days={['2026-09-24']}
          events={events}
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
    const block = container.querySelector('[data-key="weekly"]') as HTMLElement
    const parts = Array.from(block.firstElementChild!.children) as HTMLElement[]
    const title = parts.findIndex((part) => part.textContent === 'Weekly')
    expect(parts[title].classList.contains('flex-1')).toBe(true)
    expect(parts[title + 1].getAttribute('aria-label')).toBe('Reminder')
    expect(parts[title + 2].getAttribute('aria-label')).toBe('Repeats')
    expect(parts[parts.length - 1].textContent).toMatch(/^\d{1,2}:\d{2}/)
  })

  it('shows no reminder mark on an event without one', () => {
    cleanup()
    const find = draw()
    expect(find('standup').querySelector('[aria-label="Reminder"]')).toBeNull()
  })
})

describe('TimeGrid event states', () => {
  const at = (day: number, hour: number) => Date.UTC(2026, 8, day, hour) / 1000
  const events: CalendarEvent[] = [
    {
      key: 'called',
      title: 'Called off',
      colour: '#60a5fa',
      start: at(23, 9),
      finish: at(23, 10),
      allday: false,
      status: 'cancelled',
    },
    {
      key: 'maybe',
      title: 'Maybe',
      colour: '#a855f7',
      start: at(24, 11),
      finish: at(24, 12),
      allday: false,
      status: 'tentative',
    },
    {
      key: 'blank',
      title: '',
      colour: '#f97316',
      start: at(25, 9),
      finish: at(25, 10),
      allday: false,
    },
    {
      key: 'offsite',
      title: 'Offsite',
      colour: '#22c55e',
      start: at(24, 0),
      finish: at(25, 0),
      allday: true,
      date: '2026-09-24',
      status: 'tentative',
    },
  ]

  function draw(days = WEEK, selected?: string) {
    cleanup()
    vi.useFakeTimers({
      now: new Date(Date.UTC(2026, 8, 22, 12)),
      toFake: ['Date'],
    })
    const { container } = render(
      <I18nProvider i18n={i18n}>
        <TimeGrid
          days={days}
          events={events}
          duration={60}
          hours={{ start: 8, finish: 17 }}
          workdays={[1, 2, 3, 4, 5]}
          today='2026-09-22'
          selected={selected}
          onSelect={vi.fn()}
          onCreate={vi.fn()}
          onMove={vi.fn()}
          onDay={vi.fn()}
        />
      </I18nProvider>
    )
    vi.useRealTimers()
    return (key: string) =>
      container.querySelector(`[data-key="${key}"]`) as HTMLElement
  }

  const dot = (element: HTMLElement) =>
    element.querySelector('[aria-hidden].rounded-full') as HTMLElement

  it('strikes through and quietens a cancelled event', () => {
    const block = draw()('called')
    expect(
      screen.getByText('Called off').classList.contains('line-through')
    ).toBe(true)
    expect(block.classList.contains('opacity-60')).toBe(true)
  })

  it('draws a tentative event with a ring for its dot and a dashed card', () => {
    const find = draw()
    const block = find('maybe')
    expect(block.classList.contains('border-dashed')).toBe(true)
    expect(dot(block).style.borderColor).toBe('rgb(168, 85, 247)')
    expect(dot(block).style.backgroundColor).toBe('')
    expect(find('offsite').classList.contains('border-dashed')).toBe(true)
    expect(find('called').classList.contains('border-dashed')).toBe(false)
  })

  it('names an event with no title, quietly', () => {
    draw()
    const title = screen.getByText('(No title)')
    expect(title.classList.contains('text-muted-foreground')).toBe(true)
  })

  it('tints the open event', () => {
    const find = draw(WEEK, 'maybe')
    expect(find('maybe').classList.contains('bg-primary/10')).toBe(true)
    expect(find('maybe').classList.contains('bg-surface-2')).toBe(false)
    expect(find('called').classList.contains('bg-primary/10')).toBe(false)
  })

  it("reads a week block's time as a range under its title", () => {
    const block = draw()('maybe')
    expect(block.children[1].textContent).toMatch(
      /^\d{1,2}:\d{2} to \d{1,2}:\d{2}$/
    )
  })

  it("reads a single day's block time as a range at the end of its line", () => {
    const block = draw(['2026-09-24'])('maybe')
    const parts = Array.from(block.firstElementChild!.children)
    expect(parts[parts.length - 1].textContent).toMatch(
      /^\d{1,2}:\d{2} to \d{1,2}:\d{2}$/
    )
  })
})
