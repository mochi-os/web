// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: Apache-2.0

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, render, screen } from '@testing-library/react'
import { I18nProvider } from '@lingui/react'
import { i18n } from '@lingui/core'
import { MonthGrid } from './month-grid'
import { PAGE_HOLD_MS, TOUCH_HOLD_MS } from './gesture'
import type { CalendarEvent, DayMove } from './types'

const WEEKS = [
  '2026-09-21',
  '2026-09-22',
  '2026-09-23',
  '2026-09-24',
  '2026-09-25',
  '2026-09-26',
  '2026-09-27',
  '2026-09-28',
  '2026-09-29',
  '2026-09-30',
  '2026-10-01',
  '2026-10-02',
  '2026-10-03',
  '2026-10-04',
]

const at = (day: string, minutes: number) =>
  Date.UTC(
    2026,
    Number(day.slice(5, 7)) - 1,
    Number(day.slice(8)),
    0,
    minutes
  ) / 1000

const meeting: CalendarEvent = {
  key: 'e1',
  title: 'Standup',
  colour: '#2563eb',
  start: at('2026-09-22', 540),
  finish: at('2026-09-22', 600),
  allday: false,
}

const pointer = (
  pointerType: 'mouse' | 'touch',
  clientX: number,
  clientY: number,
  rest: Record<string, unknown> = {}
) => ({ pointerId: 1, pointerType, clientX, clientY, button: 0, ...rest })

let container: HTMLElement
let under: (x: number, y: number) => Element | null = () => null
let frames: FrameRequestCallback[] = []
const frame = () => {
  const due = frames
  frames = []
  act(() => {
    for (const callback of due) callback(0)
  })
}

function show(events: CalendarEvent[], range = true) {
  const onMove = vi.fn<(move: DayMove) => void>()
  const onSelect = vi.fn()
  const onStep = vi.fn()
  const onCreate = vi.fn<(day: string) => void>()
  const onCreateRange = vi.fn<(first: string, last: string) => void>()
  container = render(
    <I18nProvider i18n={i18n}>
      <MonthGrid
        days={WEEKS}
        month={9}
        events={events}
        today='2026-09-21'
        onSelect={onSelect}
        onCreate={onCreate}
        onCreateRange={range ? onCreateRange : undefined}
        onMove={onMove}
        onDay={vi.fn()}
        onStep={onStep}
      />
    </I18nProvider>
  ).container
  return { onMove, onSelect, onStep, onCreate, onCreateRange }
}

const cell = (day: string) =>
  container.querySelector(`[data-day="${day}"]`) as HTMLElement
// The chip or bar itself, never the lifted copy, which carries no key.
const chip = (title: string) =>
  screen
    .getAllByText(title)
    .map((element) => element.closest('[data-key]'))
    .find(Boolean) as HTMLElement
const ghost = () => screen.queryByTestId('ghost')
/** Lets the next move land on a day, as the browser reports the cell there. */
const over = (day: string) => {
  under = () => cell(day)
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] })
  frames = []
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
    frames.push(callback)
    return frames.length
  })
  vi.stubGlobal('cancelAnimationFrame', () => {})
  under = () => null
  Object.defineProperty(document, 'elementFromPoint', {
    configurable: true,
    value: (x: number, y: number) => under(x, y),
  })
  // The week rows fill a box 200px down from the top of the page, tall
  // enough that a week's bars all fit above its chips.
  vi.spyOn(Element.prototype, 'clientHeight', 'get').mockImplementation(
    function (this: Element) {
      return (this as HTMLElement).dataset?.testid === 'weeks' ? 600 : 0
    }
  )
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(
    function (this: HTMLElement) {
      const top = this.dataset.testid === 'weeks' ? 200 : 0
      return {
        left: 0,
        top,
        right: 700,
        bottom: 800,
        width: 700,
        height: 800 - top,
        x: 0,
        y: top,
        toJSON: () => ({}),
      } as DOMRect
    }
  )
})

afterEach(() => {
  vi.runOnlyPendingTimers()
  vi.useRealTimers()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  delete (document as { elementFromPoint?: unknown }).elementFromPoint
})

describe('MonthGrid dragging a chip', () => {
  it('drops a chip on the day under the mouse, showing it there on the way', () => {
    const { onMove, onSelect } = show([meeting])
    const target = chip('Standup')
    fireEvent.pointerDown(target, pointer('mouse', 150, 300))
    fireEvent.pointerMove(window, pointer('mouse', 152, 302))
    expect(ghost()).toBeNull()
    over('2026-09-24')
    fireEvent.pointerMove(window, pointer('mouse', 350, 300))
    expect(ghost()).not.toBeNull()
    expect(cell('2026-09-24').contains(ghost())).toBe(true)
    expect(ghost()!.textContent).toMatch(/09:00/)
    expect(ghost()!.textContent).toMatch(/Standup/)
    expect(target.classList.contains('opacity-40')).toBe(true)
    fireEvent.pointerUp(window, pointer('mouse', 350, 300))
    expect(onMove).toHaveBeenCalledWith({
      key: 'e1',
      day: '2026-09-24',
      copy: false,
    })
    fireEvent.click(target)
    expect(onSelect).not.toHaveBeenCalled()
  })

  it('shows a scrolled day its top, where the chip dragged onto it is drawn', () => {
    const lunch: CalendarEvent = {
      ...meeting,
      key: 'e2',
      title: 'Lunch',
      start: at('2026-09-24', 720),
      finish: at('2026-09-24', 780),
    }
    show([meeting, lunch])
    const list = cell('2026-09-24').querySelector('[data-list]') as HTMLElement
    Object.defineProperty(list, 'scrollTop', {
      configurable: true,
      writable: true,
      value: 60,
    })
    fireEvent.pointerDown(chip('Standup'), pointer('mouse', 150, 300))
    over('2026-09-24')
    fireEvent.pointerMove(window, pointer('mouse', 350, 300))
    expect(list.contains(ghost())).toBe(true)
    expect(list.scrollTop).toBe(0)
    fireEvent.pointerUp(window, pointer('mouse', 350, 300))
  })

  it('writes nothing for a chip dropped back on its own day', () => {
    const { onMove } = show([meeting])
    fireEvent.pointerDown(chip('Standup'), pointer('mouse', 150, 300))
    over('2026-09-24')
    fireEvent.pointerMove(window, pointer('mouse', 350, 300))
    over('2026-09-22')
    fireEvent.pointerMove(window, pointer('mouse', 150, 300))
    fireEvent.pointerUp(window, pointer('mouse', 150, 300))
    expect(onMove).not.toHaveBeenCalled()
  })

  it('lifts a chip under a finger only after the hold', () => {
    const { onMove } = show([meeting])
    fireEvent.pointerDown(chip('Standup'), pointer('touch', 150, 300))
    over('2026-09-24')
    fireEvent.pointerMove(window, pointer('touch', 350, 300))
    act(() => {
      vi.advanceTimersByTime(TOUCH_HOLD_MS)
    })
    expect(ghost()).toBeNull()
    fireEvent.pointerUp(window, pointer('touch', 350, 300))
    expect(onMove).not.toHaveBeenCalled()

    fireEvent.pointerDown(chip('Standup'), pointer('touch', 150, 300))
    act(() => {
      vi.advanceTimersByTime(TOUCH_HOLD_MS)
    })
    expect(ghost()).not.toBeNull()
    fireEvent.pointerMove(window, pointer('touch', 350, 300))
    fireEvent.pointerUp(window, pointer('touch', 350, 300))
    expect(onMove).toHaveBeenCalledWith({
      key: 'e1',
      day: '2026-09-24',
      copy: false,
    })
  })

  it('copies while Alt is held', () => {
    const { onMove } = show([meeting])
    fireEvent.pointerDown(chip('Standup'), pointer('mouse', 150, 300))
    over('2026-09-24')
    fireEvent.pointerMove(window, pointer('mouse', 350, 300, { altKey: true }))
    expect(ghost()!.querySelector('[aria-label="Copy"]')).not.toBeNull()
    fireEvent.pointerUp(window, pointer('mouse', 350, 300, { altKey: true }))
    expect(onMove).toHaveBeenCalledWith({
      key: 'e1',
      day: '2026-09-24',
      copy: true,
    })
  })

  it('moves a chip to the calendar whose row it lands on', () => {
    const row = document.createElement('div')
    row.dataset.drop = 'cal-2'
    document.body.appendChild(row)
    try {
      const { onMove } = show([meeting])
      fireEvent.pointerDown(chip('Standup'), pointer('mouse', 150, 300))
      under = () => row
      fireEvent.pointerMove(window, pointer('mouse', -20, 300))
      expect(row.hasAttribute('data-over')).toBe(true)
      expect(ghost()).toBeNull()
      fireEvent.pointerUp(window, pointer('mouse', -20, 300))
      expect(onMove).toHaveBeenCalledWith({
        key: 'e1',
        day: '2026-09-22',
        copy: false,
        calendar: 'cal-2',
      })
      expect(row.hasAttribute('data-over')).toBe(false)
    } finally {
      row.remove()
    }
  })

  it('turns the page while a chip rests at the bottom', () => {
    const { onStep } = show([meeting])
    fireEvent.pointerDown(chip('Standup'), pointer('mouse', 150, 300))
    fireEvent.pointerMove(window, pointer('mouse', 150, 790))
    frame()
    act(() => {
      vi.advanceTimersByTime(PAGE_HOLD_MS)
    })
    frame()
    expect(onStep).toHaveBeenCalledWith(1)
    fireEvent.pointerMove(window, pointer('mouse', 150, 210))
    frame()
    act(() => {
      vi.advanceTimersByTime(PAGE_HOLD_MS)
    })
    frame()
    expect(onStep).toHaveBeenLastCalledWith(-1)
    fireEvent.pointerUp(window, pointer('mouse', 150, 210))
  })
})

describe('MonthGrid dragging a bar', () => {
  const retreat: CalendarEvent = {
    key: 'e3',
    title: 'Retreat',
    colour: '#16a34a',
    start: at('2026-09-22', 0),
    finish: at('2026-09-25', 0),
    allday: true,
    date: '2026-09-22',
  }
  const lunch: CalendarEvent = {
    key: 'e4',
    title: 'Lunch',
    colour: '#2563eb',
    start: at('2026-09-26', 720),
    finish: at('2026-09-26', 780),
    allday: false,
  }

  const days = (element: HTMLElement[]) =>
    element.map((item) => item.closest('[data-day]')!.getAttribute('data-day'))

  it('lays the whole event out where it would land, wrapping into the next week', () => {
    const { onMove } = show([retreat, lunch])
    fireEvent.pointerDown(chip('Retreat'), pointer('mouse', 150, 300))
    over('2026-09-26')
    fireEvent.pointerMove(window, pointer('mouse', 650, 300))
    const ghosts = screen.getAllByTestId('ghost')
    // Three days from Saturday: two in this week, one in the next.
    expect(days(ghosts)).toEqual(['2026-09-26', '2026-09-27', '2026-09-28'])
    expect(ghosts.every((ghost) => ghost.textContent === 'Retreat')).toBe(true)
    // It leads Saturday's all-day events, above the day's lunch.
    const saturday = cell('2026-09-26')
    expect(saturday.querySelector('[data-band]')!.firstElementChild).toBe(
      ghosts[0]
    )
    expect(
      saturday
        .querySelector('[data-band]')!
        .compareDocumentPosition(chip('Lunch')) &
        Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy()
    expect(chip('Retreat').classList.contains('opacity-40')).toBe(true)
    fireEvent.pointerUp(window, pointer('mouse', 650, 300))
    expect(onMove).toHaveBeenCalledWith({
      key: 'e3',
      day: '2026-09-26',
      copy: false,
    })
  })

  it('moves the whole event by as many days, whichever of its days was taken', () => {
    const { onMove } = show([retreat])
    // The middle day, the 23rd, carried onto the 26th: three days on.
    const middle = cell('2026-09-23').querySelector(
      '[data-key="e3"]'
    ) as HTMLElement
    fireEvent.pointerDown(middle, pointer('mouse', 250, 300))
    over('2026-09-26')
    fireEvent.pointerMove(window, pointer('mouse', 650, 300))
    expect(days(screen.getAllByTestId('ghost'))).toEqual([
      '2026-09-25',
      '2026-09-26',
      '2026-09-27',
    ])
    fireEvent.pointerUp(window, pointer('mouse', 650, 300))
    expect(onMove).toHaveBeenCalledWith({
      key: 'e3',
      day: '2026-09-25',
      copy: false,
    })
  })

  it('leaves the days the event only passes over as they were', () => {
    show([retreat, lunch])
    fireEvent.pointerDown(chip('Retreat'), pointer('mouse', 150, 300))
    over('2026-09-23')
    fireEvent.pointerMove(window, pointer('mouse', 250, 300))
    // The copy falls on the 23rd to the 25th; Saturday's lunch still starts
    // its day, and the 22nd holds only the faded original.
    expect(days(screen.getAllByTestId('ghost'))).toEqual([
      '2026-09-23',
      '2026-09-24',
      '2026-09-25',
    ])
    expect(cell('2026-09-26').querySelector('[data-band]')).toBeNull()
    expect(
      cell('2026-09-22').querySelectorAll('[data-testid="ghost"]')
    ).toHaveLength(0)
    fireEvent.pointerUp(window, pointer('mouse', 250, 300))
  })

  it('shows each day it would land on its top, where the lifted copy is drawn', () => {
    // Starting before where the copy would, so only the lift puts the copy first.
    const offsite: CalendarEvent = {
      ...retreat,
      key: 'e5',
      title: 'Offsite',
      readonly: true,
    }
    show([retreat, offsite])
    const band = cell('2026-09-24').querySelector('[data-band]') as HTMLElement
    Object.defineProperty(band, 'scrollTop', {
      configurable: true,
      writable: true,
      value: 24,
    })
    fireEvent.pointerDown(chip('Retreat'), pointer('mouse', 150, 300))
    over('2026-09-23')
    fireEvent.pointerMove(window, pointer('mouse', 250, 300))
    expect(band.firstElementChild).toBe(
      screen.getAllByTestId('ghost').find((ghost) => band.contains(ghost))
    )
    expect(band.scrollTop).toBe(0)
    fireEvent.pointerUp(window, pointer('mouse', 250, 300))
  })

  it('draws no lifted copy while the bar has not left its day', () => {
    show([retreat])
    fireEvent.pointerDown(chip('Retreat'), pointer('mouse', 150, 300))
    over('2026-09-22')
    fireEvent.pointerMove(window, pointer('mouse', 160, 305))
    expect(ghost()).toBeNull()
    expect(chip('Retreat').classList.contains('opacity-40')).toBe(false)
    fireEvent.pointerUp(window, pointer('mouse', 160, 305))
  })
})

describe('MonthGrid keyboard', () => {
  it('moves a focused chip by a day and a week with the arrows, and drops it on Enter', () => {
    const { onMove } = show([meeting])
    const target = chip('Standup')
    target.focus()
    fireEvent.keyDown(target, { key: 'ArrowRight' })
    expect(cell('2026-09-23').contains(ghost())).toBe(true)
    expect(document.activeElement).toBe(ghost())
    fireEvent.keyDown(ghost()!, { key: 'ArrowDown' })
    expect(cell('2026-09-30').contains(ghost())).toBe(true)
    fireEvent.keyDown(ghost()!, { key: 'Enter' })
    expect(onMove).toHaveBeenCalledWith({
      key: 'e1',
      day: '2026-09-30',
      copy: false,
    })
  })

  it('puts the chip back on Escape', () => {
    const { onMove } = show([meeting])
    fireEvent.keyDown(chip('Standup'), { key: 'ArrowLeft' })
    expect(ghost()).not.toBeNull()
    fireEvent.keyDown(ghost()!, { key: 'Escape' })
    expect(ghost()).toBeNull()
    expect(onMove).not.toHaveBeenCalled()
    expect(document.activeElement).toBe(chip('Standup'))
  })

  it('asks for the previous page when the chip leaves the shown days', () => {
    const { onStep } = show([meeting])
    fireEvent.keyDown(chip('Standup'), { key: 'ArrowUp' })
    expect(onStep).toHaveBeenCalledWith(-1)
  })
})

describe('MonthGrid picking days', () => {
  /** Whether a day is drawn as part of the run being picked. */
  const lit = (day: string) => cell(day).classList.contains('bg-primary/10')

  it('picks the days a mouse drag crosses, drawing them on the way', () => {
    const { onCreate, onCreateRange } = show([])
    over('2026-09-23')
    fireEvent.pointerDown(cell('2026-09-23'), pointer('mouse', 250, 300))
    over('2026-09-30')
    fireEvent.pointerMove(window, pointer('mouse', 250, 400))
    expect(lit('2026-09-23')).toBe(true)
    expect(lit('2026-09-27')).toBe(true)
    expect(lit('2026-09-30')).toBe(true)
    expect(lit('2026-09-22')).toBe(false)
    expect(lit('2026-10-01')).toBe(false)
    fireEvent.pointerUp(window, pointer('mouse', 250, 400))
    expect(onCreateRange).toHaveBeenCalledWith('2026-09-23', '2026-09-30')
    expect(lit('2026-09-23')).toBe(false)
    fireEvent.click(cell('2026-09-30'))
    expect(onCreate).not.toHaveBeenCalled()
  })

  it('gives the run in order when dragged backwards', () => {
    const { onCreateRange } = show([])
    fireEvent.pointerDown(cell('2026-09-25'), pointer('mouse', 450, 300))
    over('2026-09-22')
    fireEvent.pointerMove(window, pointer('mouse', 150, 300))
    fireEvent.pointerUp(window, pointer('mouse', 150, 300))
    expect(onCreateRange).toHaveBeenCalledWith('2026-09-22', '2026-09-25')
  })

  it('creates on the one day when the drag ends where it began', () => {
    const { onCreate, onCreateRange } = show([])
    fireEvent.pointerDown(cell('2026-09-23'), pointer('mouse', 250, 300))
    over('2026-09-24')
    fireEvent.pointerMove(window, pointer('mouse', 350, 300))
    over('2026-09-23')
    fireEvent.pointerMove(window, pointer('mouse', 250, 300))
    fireEvent.pointerUp(window, pointer('mouse', 250, 300))
    fireEvent.click(cell('2026-09-23'))
    expect(onCreateRange).not.toHaveBeenCalled()
    expect(onCreate).toHaveBeenCalledTimes(1)
    expect(onCreate).toHaveBeenCalledWith('2026-09-23')
  })

  it('leaves a click a click', () => {
    const { onCreate, onCreateRange } = show([])
    fireEvent.pointerDown(cell('2026-09-23'), pointer('mouse', 250, 300))
    fireEvent.pointerMove(window, pointer('mouse', 252, 301))
    fireEvent.pointerUp(window, pointer('mouse', 252, 301))
    fireEvent.click(cell('2026-09-23'))
    expect(lit('2026-09-23')).toBe(false)
    expect(onCreateRange).not.toHaveBeenCalled()
    expect(onCreate).toHaveBeenCalledWith('2026-09-23')
  })

  it('drops the run on Escape', () => {
    const { onCreate, onCreateRange } = show([])
    fireEvent.pointerDown(cell('2026-09-23'), pointer('mouse', 250, 300))
    over('2026-09-25')
    fireEvent.pointerMove(window, pointer('mouse', 450, 300))
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(lit('2026-09-24')).toBe(false)
    fireEvent.pointerUp(window, pointer('mouse', 450, 300))
    expect(onCreateRange).not.toHaveBeenCalled()
    expect(onCreate).not.toHaveBeenCalled()
  })

  it('picks under a finger only after the hold, so a swipe still scrolls', () => {
    const { onCreateRange } = show([])
    fireEvent.pointerDown(cell('2026-09-23'), pointer('touch', 250, 300))
    over('2026-09-25')
    fireEvent.pointerMove(window, pointer('touch', 450, 300))
    act(() => {
      vi.advanceTimersByTime(TOUCH_HOLD_MS)
    })
    fireEvent.pointerUp(window, pointer('touch', 450, 300))
    expect(onCreateRange).not.toHaveBeenCalled()

    fireEvent.pointerDown(cell('2026-09-23'), pointer('touch', 250, 300))
    act(() => {
      vi.advanceTimersByTime(TOUCH_HOLD_MS)
    })
    expect(lit('2026-09-23')).toBe(true)
    fireEvent.pointerMove(window, pointer('touch', 450, 300))
    fireEvent.pointerUp(window, pointer('touch', 450, 300))
    expect(onCreateRange).toHaveBeenCalledWith('2026-09-23', '2026-09-25')
  })

  it('starts no run from an event or a day number', () => {
    const { onCreateRange, onMove } = show([meeting])
    fireEvent.pointerDown(chip('Standup'), pointer('mouse', 150, 300))
    over('2026-09-24')
    fireEvent.pointerMove(window, pointer('mouse', 350, 300))
    fireEvent.pointerUp(window, pointer('mouse', 350, 300))
    expect(onMove).toHaveBeenCalled()

    const number = cell('2026-09-23').querySelector('button') as HTMLElement
    fireEvent.pointerDown(number, pointer('mouse', 250, 210))
    over('2026-09-25')
    fireEvent.pointerMove(window, pointer('mouse', 450, 300))
    expect(lit('2026-09-25')).toBe(false)
    fireEvent.pointerUp(window, pointer('mouse', 450, 300))
    expect(onCreateRange).not.toHaveBeenCalled()
  })

  it('picks nothing without a range handler', () => {
    show([], false)
    fireEvent.pointerDown(cell('2026-09-23'), pointer('mouse', 250, 300))
    over('2026-09-25')
    fireEvent.pointerMove(window, pointer('mouse', 450, 300))
    expect(lit('2026-09-24')).toBe(false)
    fireEvent.pointerUp(window, pointer('mouse', 450, 300))
  })
})
