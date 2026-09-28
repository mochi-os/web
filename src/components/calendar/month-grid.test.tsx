// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: Apache-2.0

import { describe, it, expect, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { I18nProvider } from '@lingui/react'
import { i18n } from '@lingui/core'
import { MonthGrid } from './month-grid'
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

describe('MonthGrid all-day placement', () => {
  it('draws an all-day occurrence on its own date, not on the days its instants fall', () => {
    // Expanded by a server nine hours ahead of this browser's UTC: the instants
    // begin on the 21st here, but the occurrence is the 22nd, one day long.
    const start = Date.UTC(2026, 8, 21, 15) / 1000
    render(
      <I18nProvider i18n={i18n}>
        <MonthGrid
          days={WEEK}
          month={9}
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
          today='2026-09-22'
          onSelect={vi.fn()}
          onCreate={vi.fn()}
          onMove={vi.fn()}
          onDay={vi.fn()}
        />
      </I18nProvider>
    )
    const bar = screen.getByRole('button', { name: /Laundry/ })
    // One column wide, starting in the second column: Tuesday the 22nd.
    // jsdom rounds the percentage; one column is 14.28…%, two would be 28.57…%.
    expect(bar.style.width).toMatch(/^calc\(14\.28\d*% - 4px\)$/)
    expect(bar.style.insetInlineStart).toMatch(/^calc\(14\.28\d*% \+ 2px\)$/)
  })
})

describe('MonthGrid wheel', () => {
  function grid(onStep: (direction: number) => void) {
    const { container } = render(
      <I18nProvider i18n={i18n}>
        <MonthGrid
          days={WEEK}
          month={9}
          events={[]}
          today='2026-09-22'
          onSelect={vi.fn()}
          onCreate={vi.fn()}
          onMove={vi.fn()}
          onDay={vi.fn()}
          onStep={onStep}
        />
      </I18nProvider>
    )
    return container.firstChild as HTMLElement
  }

  it('steps forward on a wheel notch down', () => {
    const onStep = vi.fn()
    fireEvent.wheel(grid(onStep), { deltaY: 100 })
    expect(onStep).toHaveBeenCalledWith(1)
  })

  it('steps back on a wheel notch up', () => {
    const onStep = vi.fn()
    fireEvent.wheel(grid(onStep), { deltaY: -100 })
    expect(onStep).toHaveBeenCalledWith(-1)
  })

  it('does not step on a delta under the threshold', () => {
    const onStep = vi.fn()
    fireEvent.wheel(grid(onStep), { deltaY: 5 })
    expect(onStep).not.toHaveBeenCalled()
  })
})

describe('MonthGrid event appearance', () => {
  const at = (day: number, hour: number) => Date.UTC(2026, 8, day, hour) / 1000
  const events = [
    {
      key: 'standup',
      title: 'Standup',
      colour: '#60a5fa',
      start: at(23, 9),
      finish: at(23, 10),
      allday: false,
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
        <MonthGrid
          days={WEEK}
          month={9}
          events={events}
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

  it('reads a timed event as its dot and title, with its time on a line under the title', () => {
    const chip = draw()('standup')
    const [first, second] = Array.from(chip.children) as HTMLElement[]
    const dot = first.firstElementChild as HTMLElement
    expect(dot.getAttribute('aria-hidden')).toBe('true')
    expect(dot.classList.contains('rounded-full')).toBe(true)
    expect(dot.style.backgroundColor).toBe('rgb(96, 165, 250)')
    expect(first.textContent).toBe('Standup')
    expect(second.textContent).toMatch(/^\d{1,2}:\d{2}/)
    // Aligned with the title, not the dot.
    expect(second.classList.contains('ps-3.5')).toBe(true)
    expect(chip.style.borderInlineStartColor).toBe('')
    expect(chip.style.backgroundColor).toBe('')
  })

  it('draws an all-day event as its dot and its title, with no time', () => {
    const bar = draw()('holiday')
    // No fill: the grey card is for the week's timed blocks only.
    expect(bar.className).not.toMatch(/(^|\s)bg-/)
    expect([...bar.classList].some((name) => name.startsWith('border'))).toBe(
      false
    )
    expect((bar.firstElementChild as HTMLElement).style.backgroundColor).toBe(
      'rgb(34, 197, 94)'
    )
    expect(bar.textContent).toBe('Holiday')
    expect(bar.style.borderInlineStartColor).toBe('')
  })

  it('draws an event that is over quieter than one still to come', () => {
    const find = draw()
    expect(find('earlier').classList.contains('opacity-60')).toBe(true)
    expect(find('standup').classList.contains('opacity-60')).toBe(false)
  })

  it('puts the time, then the repeat mark, then the reminder under the title', () => {
    const chip = draw()('weekly')
    const second = chip.children[1] as HTMLElement
    const parts = Array.from(second.children) as HTMLElement[]
    expect(parts[0].textContent).toMatch(/^\d{1,2}:\d{2}/)
    expect(parts[1].getAttribute('aria-label')).toBe('Repeats')
    expect(parts[2].getAttribute('aria-label')).toBe('Reminder')
  })

  it('shows no reminder mark on an event without one', () => {
    const find = draw()
    expect(find('standup').querySelector('[aria-label="Reminder"]')).toBeNull()
  })
})

describe('MonthGrid day lists', () => {
  const at = (hour: number) => Date.UTC(2026, 8, 23, hour) / 1000
  // Eight timed events on the 23rd, more than any cell has room for.
  const busy = Array.from({ length: 8 }, (_, index) => ({
    key: `busy${index}`,
    title: `Busy ${index}`,
    colour: '#60a5fa',
    start: at(8 + index),
    finish: at(8 + index) + 1800,
    allday: false,
  }))

  function draw(onStep = vi.fn(), onCreate = vi.fn()) {
    const { container } = render(
      <I18nProvider i18n={i18n}>
        <MonthGrid
          days={WEEK}
          month={9}
          events={busy}
          today='2026-09-22'
          onSelect={vi.fn()}
          onCreate={onCreate}
          onMove={vi.fn()}
          onDay={vi.fn()}
          onStep={onStep}
        />
      </I18nProvider>
    )
    const list = cell(container, '2026-09-23').querySelector(
      '[data-list]'
    ) as HTMLElement
    return { container, list, onStep, onCreate }
  }

  /** Gives the list a height and a content height, as a browser lays it out. */
  const size = (list: HTMLElement, client: number, scroll: number) => {
    Object.defineProperty(list, 'clientHeight', {
      configurable: true,
      value: client,
    })
    Object.defineProperty(list, 'scrollHeight', {
      configurable: true,
      value: scroll,
    })
  }

  it('draws every event of a day in a list that scrolls, with no "more" line', () => {
    const { container, list } = draw()
    expect(list.querySelectorAll('[data-key]')).toHaveLength(8)
    expect(list.classList.contains('overflow-y-auto')).toBe(true)
    expect(container.textContent).not.toMatch(/more/)
  })

  it('scrolls an overflowing day under the wheel instead of paging', () => {
    const { list, onStep } = draw()
    size(list, 80, 320)
    fireEvent.wheel(list.querySelector('[data-key]')!, { deltaY: 100 })
    expect(onStep).not.toHaveBeenCalled()
  })

  it('pages under the wheel over a day whose events fit', () => {
    const { list, onStep } = draw()
    size(list, 320, 320)
    fireEvent.wheel(list.querySelector('[data-key]')!, { deltaY: 100 })
    expect(onStep).toHaveBeenCalledWith(1)
  })

  it("creates an event from the empty space below a day's events", () => {
    const { list, onCreate } = draw()
    fireEvent.click(list)
    expect(onCreate).toHaveBeenCalledWith('2026-09-23')
  })
})

describe('MonthGrid bars', () => {
  const day = (hour: number) => Date.UTC(2026, 8, 23, hour) / 1000
  // All-day events on the 23rd, one bar row each.
  const holidays = (count: number) =>
    Array.from({ length: count }, (_, index) => ({
      key: `holiday${index}`,
      title: `Holiday ${index}`,
      colour: '#22c55e',
      start: day(0),
      finish: day(24),
      allday: true,
      date: '2026-09-23',
    }))
  const standup = {
    key: 'standup',
    title: 'Standup',
    colour: '#60a5fa',
    start: Date.UTC(2026, 8, 24, 9) / 1000,
    finish: Date.UTC(2026, 8, 24, 10) / 1000,
    allday: false,
  }

  /** Draws one week in a row `height` pixels tall. */
  function draw(events: CalendarEvent[], height: number, onStep = vi.fn()) {
    const tall = vi
      .spyOn(Element.prototype, 'clientHeight', 'get')
      .mockImplementation(function (this: Element) {
        return (this as HTMLElement).dataset?.testid === 'weeks' ? height : 0
      })
    const { container } = render(
      <I18nProvider i18n={i18n}>
        <MonthGrid
          days={WEEK}
          month={9}
          events={events}
          today='2026-09-22'
          onSelect={vi.fn()}
          onCreate={vi.fn()}
          onMove={vi.fn()}
          onDay={vi.fn()}
          onStep={onStep}
        />
      </I18nProvider>
    )
    tall.mockRestore()
    const band = container.querySelector('[data-band]') as HTMLElement
    const list = container.querySelector('[data-list]') as HTMLElement | null
    return { container, band, list, onStep }
  }

  it('gives the bars all the height they need while they fit', () => {
    const { band, list } = draw([...holidays(3), standup], 600)
    expect(band.style.height).toBe('84px')
    expect(list!.style.top).toBe('112px')
  })

  it('leaves each day room for one timed event, the rest of the bars scrolling', () => {
    const { band, list } = draw([...holidays(4), standup], 150)
    // 150 less the day number, the margin and one event.
    expect(band.style.height).toBe('80px')
    expect(band.classList.contains('overflow-y-auto')).toBe(true)
    expect(band.querySelectorAll('[data-key]')).toHaveLength(4)
    expect(list!.style.top).toBe('108px')
  })

  it('lets the bars take the whole day in a week with no timed events', () => {
    const { band } = draw(holidays(5), 150)
    expect(band.style.height).toBe('120px')
  })

  it('always shows at least one bar', () => {
    const { band } = draw([...holidays(3), standup], 60)
    expect(band.style.height).toBe('28px')
  })

  it('scrolls the bars under the wheel instead of paging when they overflow', () => {
    const { band, onStep } = draw([...holidays(4), standup], 150)
    Object.defineProperty(band, 'clientHeight', {
      configurable: true,
      value: 80,
    })
    Object.defineProperty(band, 'scrollHeight', {
      configurable: true,
      value: 112,
    })
    fireEvent.wheel(band.querySelector('[data-key]')!, { deltaY: 100 })
    expect(onStep).not.toHaveBeenCalled()
  })
})

describe('MonthGrid event states', () => {
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

  function draw(selected?: string) {
    vi.useFakeTimers({
      now: new Date(Date.UTC(2026, 8, 22, 12)),
      toFake: ['Date'],
    })
    const { container } = render(
      <I18nProvider i18n={i18n}>
        <MonthGrid
          days={WEEK}
          month={9}
          events={events}
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
    const chip = draw()('called')
    expect(
      screen.getByText('Called off').classList.contains('line-through')
    ).toBe(true)
    expect(chip.classList.contains('opacity-60')).toBe(true)
  })

  it('draws a tentative event with a ring for its dot, a bar with no outline', () => {
    const find = draw()
    expect(dot(find('maybe')).style.borderColor).toBe('rgb(168, 85, 247)')
    expect(dot(find('maybe')).style.backgroundColor).toBe('')
    expect(dot(find('offsite')).style.borderColor).toBe('rgb(34, 197, 94)')
    expect(
      [...find('offsite').classList].some((name) => name.startsWith('border'))
    ).toBe(false)
    expect(dot(find('called')).style.backgroundColor).toBe('rgb(96, 165, 250)')
  })

  it('names an event with no title, quietly', () => {
    draw()
    const title = screen.getByText('(No title)')
    expect(title.classList.contains('text-muted-foreground')).toBe(true)
  })

  it('tints the open event, chip or bar', () => {
    let find = draw('maybe')
    expect(find('maybe').classList.contains('bg-primary/10')).toBe(true)
    expect(find('called').classList.contains('bg-primary/10')).toBe(false)
    cleanup()
    find = draw('offsite')
    expect(find('offsite').classList.contains('bg-primary/10')).toBe(true)
    expect(
      [...find('offsite').classList].some((name) => name.startsWith('border'))
    ).toBe(false)
  })
})
