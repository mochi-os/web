// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: Apache-2.0

import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest'
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
  describe('a day too full for its cell', () => {
    const day = '2026-09-23'
    const start = Date.UTC(2026, 8, 23, 9) / 1000
    // A 78 px list holding 25 chips of 38 px, 2 px apart: two show whole.
    const events: CalendarEvent[] = Array.from({ length: 25 }, (_, index) => ({
      key: `event-${index}`,
      title: `Event ${index}`,
      colour: '#60a5fa',
      start: start + index * 60,
      finish: start + index * 60 + 30,
      allday: false,
    }))
    const scroll = { top: 0 }
    const spies: { mockRestore: () => void }[] = []

    beforeEach(() => {
      scroll.top = 0
      const list = (element: Element) =>
        (element as HTMLElement).dataset?.list !== undefined
      spies.push(
        vi
          .spyOn(Element.prototype, 'clientHeight', 'get')
          .mockImplementation(function (this: Element) {
            return list(this) ? 78 : 0
          }),
        vi
          .spyOn(Element.prototype, 'scrollHeight', 'get')
          .mockImplementation(function (this: Element) {
            return list(this) ? 25 * 38 + 24 * 2 : 0
          }),
        vi
          .spyOn(Element.prototype, 'getBoundingClientRect')
          .mockImplementation(function (this: Element) {
            if (list(this)) return { top: 0, bottom: 78 } as DOMRect
            const key = (this as HTMLElement).dataset?.key ?? ''
            const index = Number(key.replace('event-', ''))
            if (!key.startsWith('event-'))
              return { top: 0, bottom: 0 } as DOMRect
            const top = index * 40 - scroll.top
            return { top, bottom: top + 38 } as DOMRect
          })
      )
    })

    afterEach(() => {
      spies.splice(0).forEach((spy) => spy.mockRestore())
    })

    const draw = (onDay = vi.fn()) =>
      render(
        <I18nProvider i18n={i18n}>
          <MonthGrid
            days={WEEK}
            events={events}
            today={day}
            onSelect={vi.fn()}
            onCreate={vi.fn()}
            onMove={vi.fn()}
            onDay={onDay}
          />
        </I18nProvider>
      )

    it('keeps every event in the list it scrolls, with no count of the rest', () => {
      const { container } = draw()
      expect(
        container.querySelectorAll(`[data-day="${day}"] [data-list] [data-key]`)
      ).toHaveLength(25)
      expect(screen.queryByRole('button', { name: /more/ })).toBeNull()
      // Half a chip down, the cell still says nothing of what it cuts off.
      scroll.top = 20
      fireEvent.scroll(container.querySelector('[data-list]')!)
      expect(screen.queryByRole('button', { name: /more/ })).toBeNull()
    })

    it('opens the day from its number', () => {
      const onDay = vi.fn()
      draw(onDay)
      fireEvent.click(screen.getByRole('button', { name: '23' }))
      expect(onDay).toHaveBeenCalledWith(day)
    })
  })

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
    const bars = screen.getAllByRole('button', { name: /Laundry/ })
    // Tuesday the 22nd alone.
    expect(bars).toHaveLength(1)
    expect(bars[0].closest('[data-day]')!.getAttribute('data-day')).toBe(
      '2026-09-22'
    )
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

describe('MonthGrid day stacking', () => {
  const day = (date: number, hour: number) =>
    Date.UTC(2026, 8, date, hour) / 1000
  // All-day events on the 23rd, one line each.
  const holidays = (count: number) =>
    Array.from({ length: count }, (_, index) => ({
      key: `holiday${index}`,
      title: `Holiday ${index}`,
      colour: '#22c55e',
      start: day(23, 0),
      finish: day(24, 0),
      allday: true,
      date: '2026-09-23',
    }))
  const timed = (key: string, date: number, hour: number) => ({
    key,
    title: key,
    colour: '#60a5fa',
    start: day(date, hour),
    finish: day(date, hour + 1),
    allday: false,
  })

  /** Draws one week in a row `height` pixels tall. */
  function draw(
    events: CalendarEvent[],
    height = 600,
    allday?: 'first' | 'last',
    onStep = vi.fn()
  ) {
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
          allday={allday}
          onSelect={vi.fn()}
          onCreate={vi.fn()}
          onMove={vi.fn()}
          onDay={vi.fn()}
          onStep={onStep}
        />
      </I18nProvider>
    )
    tall.mockRestore()
    return { container, onStep }
  }

  /** A day's groups, top to bottom, each as the keys it lists. */
  const groups = (container: HTMLElement, date: string) =>
    [...cell(container, date).querySelectorAll('[data-band], [data-list]')].map(
      (group) =>
        [...group.querySelectorAll('[data-key]')].map(
          (entry) => (entry as HTMLElement).dataset.key
        )
    )
  const band = (container: HTMLElement, date: string) =>
    cell(container, date).querySelector('[data-band]') as HTMLElement
  const list = (container: HTMLElement, date: string) =>
    cell(container, date).querySelector('[data-list]') as HTMLElement

  it("starts a day's timed events at its top, whatever the week's other days hold", () => {
    const { container } = draw([...holidays(3), timed('standup', 24, 9)])
    expect(groups(container, '2026-09-24')).toEqual([['standup']])
    expect(band(container, '2026-09-24')).toBeNull()
    // Nothing in the day sits above its list.
    expect(list(container, '2026-09-24').previousElementSibling).toBeNull()
    expect(list(container, '2026-09-24').style.top).toBe('')
  })

  it('draws a multi-day event on every day it covers, a timed one saying its start on its first day', () => {
    const retreat = {
      key: 'retreat',
      title: 'Retreat',
      colour: '#16a34a',
      start: day(22, 0),
      finish: day(25, 0),
      allday: true,
      date: '2026-09-22',
    }
    const flight = {
      ...timed('flight', 25, 22),
      finish: day(26, 6),
    }
    const { container } = draw([retreat, flight])
    for (const date of ['2026-09-22', '2026-09-23', '2026-09-24'])
      expect(groups(container, date)).toEqual([['retreat']])
    expect(groups(container, '2026-09-21')).toEqual([])
    expect(groups(container, '2026-09-25')).toEqual([['flight']])
    expect(band(container, '2026-09-25').textContent).toMatch(/22:00/)
    expect(groups(container, '2026-09-26')).toEqual([['flight']])
    expect(band(container, '2026-09-26').textContent).not.toMatch(/\d\d:\d\d/)
  })

  it('puts all-day events above the timed ones, or below them when asked', () => {
    const day23 = [...holidays(1), timed('standup', 23, 9)]
    expect(groups(draw(day23).container, '2026-09-23')).toEqual([
      ['holiday0'],
      ['standup'],
    ])
    cleanup()
    expect(groups(draw(day23, 600, 'last').container, '2026-09-23')).toEqual([
      ['standup'],
      ['holiday0'],
    ])
  })

  it('runs each group by start, all-day first at the same start, then by title', () => {
    const late = { ...timed('flight', 22, 20), finish: day(23, 6) }
    // Timed over midnight, starting when the holidays do, and named so that
    // only its being timed puts it after them.
    const overnight = {
      ...timed('night', 23, 0),
      title: 'Arrival',
      finish: day(24, 2),
    }
    const { container } = draw([
      timed('b', 23, 9),
      timed('a', 23, 9),
      timed('early', 23, 7),
      overnight,
      ...holidays(2).reverse(),
      late,
    ])
    expect(groups(container, '2026-09-23')).toEqual([
      ['flight', 'holiday0', 'holiday1', 'night'],
      ['early', 'a', 'b'],
    ])
  })

  it('gives the first group its whole height while it leaves room for one of the second', () => {
    const { container } = draw([...holidays(3), timed('standup', 23, 9)], 600)
    // 600 less the day number and the margin, less one timed event.
    expect(band(container, '2026-09-23').style.maxHeight).toBe('530px')
    expect(list(container, '2026-09-23').classList.contains('flex-1')).toBe(
      true
    )
  })

  it('holds the first group to leave room for one of the second, the rest of it scrolling', () => {
    const { container } = draw([...holidays(4), timed('standup', 23, 9)], 150)
    const bars = band(container, '2026-09-23')
    // 150 less the day number, the margin and one timed event.
    expect(bars.style.maxHeight).toBe('80px')
    expect(bars.classList.contains('overflow-y-auto')).toBe(true)
    expect(bars.querySelectorAll('[data-key]')).toHaveLength(4)
    cleanup()
    const last = draw([...holidays(4), timed('standup', 23, 9)], 150, 'last')
    // With the timed ones first, room is left for one all-day line.
    expect(list(last.container, '2026-09-23').style.maxHeight).toBe('92px')
  })

  it('lets the first group take the whole day when there is no second', () => {
    const { container } = draw(holidays(5), 150)
    const bars = band(container, '2026-09-23')
    expect(bars.style.maxHeight).toBe('')
    expect(bars.classList.contains('flex-1')).toBe(true)
  })

  it('always shows at least one of the first group', () => {
    const { container } = draw([...holidays(3), timed('standup', 23, 9)], 60)
    expect(band(container, '2026-09-23').style.maxHeight).toBe('28px')
  })

  it('scrolls a held group under the wheel instead of paging when it overflows', () => {
    const { container, onStep } = draw(
      [...holidays(4), timed('standup', 23, 9)],
      150,
      'first',
      vi.fn()
    )
    const bars = band(container, '2026-09-23')
    Object.defineProperty(bars, 'clientHeight', {
      configurable: true,
      value: 80,
    })
    Object.defineProperty(bars, 'scrollHeight', {
      configurable: true,
      value: 112,
    })
    fireEvent.wheel(bars.querySelector('[data-key]')!, { deltaY: 100 })
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

describe('MonthGrid week numbers', () => {
  const label = (first: string) => {
    const days = Array.from({ length: 7 }, (_, index) => {
      const day = new Date(`${first}T00:00:00Z`)
      day.setUTCDate(day.getUTCDate() + index)
      return day.toISOString().slice(0, 10)
    })
    render(
      <I18nProvider i18n={i18n}>
        <MonthGrid
          days={days}
          month={10}
          events={[]}
          today='2026-10-07'
          weekNumbers
          onSelect={vi.fn()}
          onCreate={vi.fn()}
          onMove={vi.fn()}
          onDay={vi.fn()}
        />
      </I18nProvider>
    )
    return screen.getByTestId('week-number').textContent
  }

  afterEach(cleanup)

  it('names the ISO week most of a Sunday-first row is in', () => {
    // Sunday 4 to Saturday 10 October: Monday on is week 41.
    expect(label('2026-10-04')).toBe('41')
  })

  it('names the ISO week most of a Saturday-first row is in', () => {
    expect(label('2026-10-03')).toBe('41')
  })

  it('names a Monday-first row by its own week, as before', () => {
    expect(label('2026-10-05')).toBe('41')
  })
})
