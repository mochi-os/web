// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: Apache-2.0

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, render, screen } from '@testing-library/react'
import { I18nProvider } from '@lingui/react'
import { i18n } from '@lingui/core'
import { TimeGrid } from './time-grid'
import { PAGE_HOLD_MS, TOUCH_HOLD_MS } from './gesture'
import type { CalendarEvent, EventMove } from './types'

const WEEK = [
  '2026-09-21',
  '2026-09-22',
  '2026-09-23',
  '2026-09-24',
  '2026-09-25',
  '2026-09-26',
  '2026-09-27',
]

// The user's zone in tests is UTC, so a day's minutes map straight to instants.
const at = (day: string, minutes: number) =>
  Date.UTC(2026, 8, Number(day.slice(8)), 0, minutes) / 1000

// The columns start 56px in for the gutter and 100px down, below the band;
// each of the seven days is 100px wide and an hour is 80px tall.
const LEFT = 56
const TOP = 100
const x = (day: string) => LEFT + WEEK.indexOf(day) * 100 + 50
const y = (minutes: number) => TOP + (minutes / 60) * 80

const rect = (left: number, top: number, width: number, height: number) =>
  ({
    left,
    top,
    right: left + width,
    bottom: top + height,
    width,
    height,
    x: left,
    y: top,
    toJSON: () => ({}),
  }) as DOMRect

const meeting: CalendarEvent = {
  key: 'e1',
  title: 'Standup',
  colour: '#2563eb',
  start: at('2026-09-22', 540),
  finish: at('2026-09-22', 600),
  allday: false,
}

const party: CalendarEvent = {
  key: 'e2',
  title: 'Party',
  colour: '#16a34a',
  start: at('2026-09-24', 0),
  finish: at('2026-09-25', 0),
  allday: true,
  date: '2026-09-24',
}

const pointer = (
  pointerType: 'mouse' | 'touch',
  clientX: number,
  clientY: number,
  rest: Record<string, unknown> = {}
) => ({ pointerId: 1, pointerType, clientX, clientY, button: 0, ...rest })

let frames: FrameRequestCallback[] = []
const frame = () => {
  const due = frames
  frames = []
  act(() => {
    for (const callback of due) callback(0)
  })
}

function show(
  events: CalendarEvent[],
  props: Partial<Parameters<typeof TimeGrid>[0]> = {}
) {
  const onMove = vi.fn<(move: EventMove) => void>()
  const onSelect = vi.fn()
  const onCreate = vi.fn()
  const onStep = vi.fn()
  render(
    <I18nProvider i18n={i18n}>
      <TimeGrid
        days={WEEK}
        events={events}
        duration={60}
        hours={{ start: 8, finish: 17 }}
        workdays={[1, 2, 3, 4, 5]}
        today='2026-09-21'
        onSelect={onSelect}
        onCreate={onCreate}
        onMove={onMove}
        onDay={vi.fn()}
        onStep={onStep}
        {...props}
      />
    </I18nProvider>
  )
  return { onMove, onSelect, onCreate, onStep }
}

const block = (title: string) =>
  screen
    .getAllByText(title)
    .map((element) => element.closest('[data-key]'))
    .find(Boolean) as HTMLElement
const ghost = () => screen.queryByTestId('ghost')

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] })
  frames = []
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
    frames.push(callback)
    return frames.length
  })
  vi.stubGlobal('cancelAnimationFrame', () => {})
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(
    function (this: HTMLElement) {
      switch (this.dataset.testid) {
        case 'scroller':
          return rect(0, TOP, 756, 600)
        case 'hours':
          return rect(LEFT, TOP, 700, 1920)
        default:
          return rect(0, 0, 756, 700)
      }
    }
  )
})

afterEach(() => {
  // A drop leaves a one-shot click swallower on a zero timer; run it out so
  // it cannot eat the next test's first click.
  vi.runOnlyPendingTimers()
  vi.useRealTimers()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

describe('TimeGrid dragging with a mouse', () => {
  it('moves a block once the mouse has travelled, in snapped steps, and writes the new span', () => {
    const { onMove, onSelect } = show([meeting])
    const target = block('Standup')
    fireEvent.pointerDown(target, pointer('mouse', x('2026-09-22'), y(540)))
    fireEvent.pointerMove(window, pointer('mouse', x('2026-09-22'), y(540) + 3))
    expect(ghost()).toBeNull()
    fireEvent.pointerMove(window, pointer('mouse', x('2026-09-22'), y(570)))
    expect(ghost()).not.toBeNull()
    // The dragged block reads the time it would land on, not where it was.
    expect(ghost()!.textContent).toMatch(/09:30 to 10:30/)
    expect(ghost()!.textContent).toMatch(/Standup/)
    fireEvent.pointerUp(window, pointer('mouse', x('2026-09-22'), y(570)))
    expect(onMove).toHaveBeenCalledWith({
      key: 'e1',
      start: at('2026-09-22', 570),
      finish: at('2026-09-22', 630),
      copy: false,
    })
    expect(ghost()).toBeNull()
    // The click the browser fires after the drop does not open the block.
    fireEvent.click(target)
    expect(onSelect).not.toHaveBeenCalled()
  })

  it('carries a block to another day', () => {
    const { onMove } = show([meeting])
    fireEvent.pointerDown(
      block('Standup'),
      pointer('mouse', x('2026-09-22'), y(540))
    )
    fireEvent.pointerMove(window, pointer('mouse', x('2026-09-24'), y(540)))
    fireEvent.pointerUp(window, pointer('mouse', x('2026-09-24'), y(540)))
    expect(onMove).toHaveBeenCalledWith({
      key: 'e1',
      start: at('2026-09-24', 540),
      finish: at('2026-09-24', 600),
      copy: false,
    })
  })

  it('opens a block that was clicked without moving, and writes nothing', () => {
    const { onMove, onSelect } = show([meeting])
    const target = block('Standup')
    fireEvent.pointerDown(target, pointer('mouse', x('2026-09-22'), y(540)))
    fireEvent.pointerUp(window, pointer('mouse', x('2026-09-22'), y(540)))
    fireEvent.click(target)
    expect(onMove).not.toHaveBeenCalled()
    expect(onSelect).toHaveBeenCalledWith('e1', target)
  })

  it('drags the end of a block to change when it finishes', () => {
    const { onMove } = show([meeting])
    const handle = block('Standup').querySelector(
      '[role="presentation"]'
    ) as HTMLElement
    fireEvent.pointerDown(handle, pointer('mouse', x('2026-09-22'), y(599)))
    fireEvent.pointerMove(window, pointer('mouse', x('2026-09-22'), y(630)))
    expect(ghost()!.textContent).toMatch(/09:00 to 10:30/)
    fireEvent.pointerUp(window, pointer('mouse', x('2026-09-22'), y(630)))
    expect(onMove).toHaveBeenCalledWith({
      key: 'e1',
      start: at('2026-09-22', 540),
      finish: at('2026-09-22', 630),
    })
  })

  it('creates an event over a dragged span, and of the default length on a click', () => {
    const { onCreate } = show([])
    const column = screen.getByTestId('hours').children[1] as HTMLElement
    fireEvent.pointerDown(column, pointer('mouse', x('2026-09-22'), y(600)))
    fireEvent.pointerUp(window, pointer('mouse', x('2026-09-22'), y(600)))
    expect(onCreate).toHaveBeenLastCalledWith(
      at('2026-09-22', 600),
      at('2026-09-22', 660)
    )
    fireEvent.pointerDown(column, pointer('mouse', x('2026-09-22'), y(600)))
    fireEvent.pointerMove(window, pointer('mouse', x('2026-09-22'), y(720)))
    fireEvent.pointerUp(window, pointer('mouse', x('2026-09-22'), y(720)))
    expect(onCreate).toHaveBeenLastCalledWith(
      at('2026-09-22', 600),
      at('2026-09-22', 720)
    )
  })

  it('leaves a read-only block where it is', () => {
    const { onMove } = show([{ ...meeting, readonly: true }])
    fireEvent.pointerDown(
      block('Standup'),
      pointer('mouse', x('2026-09-22'), y(540))
    )
    fireEvent.pointerMove(window, pointer('mouse', x('2026-09-22'), y(600)))
    expect(ghost()).toBeNull()
    fireEvent.pointerUp(window, pointer('mouse', x('2026-09-22'), y(600)))
    expect(onMove).not.toHaveBeenCalled()
  })

  it('puts a block back on Escape', () => {
    const { onMove } = show([meeting])
    fireEvent.pointerDown(
      block('Standup'),
      pointer('mouse', x('2026-09-22'), y(540))
    )
    fireEvent.pointerMove(window, pointer('mouse', x('2026-09-22'), y(600)))
    expect(ghost()).not.toBeNull()
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(ghost()).toBeNull()
    fireEvent.pointerUp(window, pointer('mouse', x('2026-09-22'), y(600)))
    expect(onMove).not.toHaveBeenCalled()
  })
})

describe('TimeGrid dragging with a finger', () => {
  it('scrolls, not drags, when the finger moves before the hold', () => {
    const { onMove } = show([meeting])
    fireEvent.pointerDown(
      block('Standup'),
      pointer('touch', x('2026-09-22'), y(540))
    )
    fireEvent.pointerMove(
      window,
      pointer('touch', x('2026-09-22'), y(540) + 15)
    )
    act(() => {
      vi.advanceTimersByTime(TOUCH_HOLD_MS)
    })
    expect(ghost()).toBeNull()
    fireEvent.pointerMove(window, pointer('touch', x('2026-09-22'), y(600)))
    fireEvent.pointerUp(window, pointer('touch', x('2026-09-22'), y(600)))
    expect(onMove).not.toHaveBeenCalled()
  })

  it('lifts the block after the hold and drops it where the finger goes', () => {
    const { onMove } = show([meeting])
    fireEvent.pointerDown(
      block('Standup'),
      pointer('touch', x('2026-09-22'), y(540))
    )
    act(() => {
      vi.advanceTimersByTime(TOUCH_HOLD_MS)
    })
    expect(ghost()).not.toBeNull()
    fireEvent.pointerMove(window, pointer('touch', x('2026-09-23'), y(600)))
    fireEvent.pointerUp(window, pointer('touch', x('2026-09-23'), y(600)))
    expect(onMove).toHaveBeenCalledWith({
      key: 'e1',
      start: at('2026-09-23', 600),
      finish: at('2026-09-23', 660),
      copy: false,
    })
  })
})

describe('TimeGrid dragging between the band and the grid', () => {
  it('makes a timed block all-day when it lands in the band', () => {
    const { onMove } = show([meeting])
    fireEvent.pointerDown(
      block('Standup'),
      pointer('mouse', x('2026-09-22'), y(540))
    )
    fireEvent.pointerMove(window, pointer('mouse', x('2026-09-23'), 50))
    expect(ghost()!.textContent).toMatch(/Standup/)
    // One day wide, in Wednesday's column of the band.
    expect(ghost()!.style.width).toMatch(/^calc\(14\.28\d*% - 2px\)$/)
    expect(ghost()!.style.insetInlineStart).toMatch(/^28\.57\d*%$/)
    fireEvent.pointerUp(window, pointer('mouse', x('2026-09-23'), 50))
    expect(onMove).toHaveBeenCalledWith({
      key: 'e1',
      start: at('2026-09-23', 0),
      finish: at('2026-09-24', 0),
      allday: true,
      copy: false,
    })
  })

  it('spans as many days in the band as a timed block covered', () => {
    const overnight: CalendarEvent = {
      key: 'e5',
      title: 'Overnight',
      colour: '#2563eb',
      start: at('2026-09-22', 1320),
      finish: at('2026-09-23', 120),
      allday: false,
    }
    show([overnight])
    fireEvent.pointerDown(
      block('Overnight'),
      pointer('mouse', x('2026-09-22'), y(1320))
    )
    fireEvent.pointerMove(window, pointer('mouse', x('2026-09-24'), 50))
    expect(ghost()!.style.width).toMatch(/^calc\(28\.57\d*% - 2px\)$/)
    expect(ghost()!.style.insetInlineStart).toMatch(/^42\.85\d*%$/)
    fireEvent.pointerUp(window, pointer('mouse', x('2026-09-24'), 50))
  })

  it('gives an all-day bar the default length at the time it lands on in the grid', () => {
    const { onMove } = show([party])
    fireEvent.pointerDown(block('Party'), pointer('mouse', x('2026-09-24'), 50))
    fireEvent.pointerMove(window, pointer('mouse', x('2026-09-22'), y(540)))
    expect(ghost()!.textContent).toMatch(/09:00 to 10:00/)
    fireEvent.pointerUp(window, pointer('mouse', x('2026-09-22'), y(540)))
    expect(onMove).toHaveBeenCalledWith({
      key: 'e2',
      start: at('2026-09-22', 540),
      finish: at('2026-09-22', 600),
      copy: false,
    })
  })

  it('lays a bar out over every day it covers where it would land', () => {
    const retreat: CalendarEvent = {
      key: 'e3',
      title: 'Retreat',
      colour: '#16a34a',
      start: at('2026-09-24', 0),
      finish: at('2026-09-26', 0),
      allday: true,
      date: '2026-09-24',
    }
    const { onMove } = show([retreat])
    fireEvent.pointerDown(
      block('Retreat'),
      pointer('mouse', x('2026-09-24'), 50)
    )
    fireEvent.pointerMove(window, pointer('mouse', x('2026-09-26'), 50))
    const lifted = ghost()!
    // Two days from Saturday, in the band's own layout.
    expect(lifted.style.insetInlineStart).toMatch(/^71\.42\d*%$/)
    expect(lifted.style.width).toMatch(/^calc\(28\.57\d*% - 2px\)$/)
    expect(lifted.textContent).toBe('Retreat')
    expect(block('Retreat').classList.contains('opacity-40')).toBe(true)
    fireEvent.pointerUp(window, pointer('mouse', x('2026-09-26'), 50))
    expect(onMove).toHaveBeenCalledWith({
      key: 'e3',
      start: at('2026-09-26', 0),
      finish: at('2026-09-27', 0),
      allday: true,
      copy: false,
    })
  })

  it('draws no lifted copy and fades nothing while a bar has not left its day', () => {
    show([party])
    fireEvent.pointerDown(block('Party'), pointer('mouse', x('2026-09-24'), 50))
    fireEvent.pointerMove(window, pointer('mouse', x('2026-09-24') + 12, 52))
    expect(ghost()).toBeNull()
    expect(block('Party').classList.contains('opacity-40')).toBe(false)
    fireEvent.pointerUp(window, pointer('mouse', x('2026-09-24') + 12, 52))
  })

  it('moves an all-day bar to another day within the band', () => {
    const { onMove } = show([party])
    fireEvent.pointerDown(block('Party'), pointer('mouse', x('2026-09-24'), 50))
    fireEvent.pointerMove(window, pointer('mouse', x('2026-09-26'), 50))
    fireEvent.pointerUp(window, pointer('mouse', x('2026-09-26'), 50))
    expect(onMove).toHaveBeenCalledWith({
      key: 'e2',
      start: at('2026-09-26', 0),
      finish: at('2026-09-27', 0),
      allday: true,
      copy: false,
    })
  })
})

describe('TimeGrid copying and dropping elsewhere', () => {
  it('copies rather than moves while Alt is held, and says so on the block', () => {
    const { onMove } = show([meeting])
    fireEvent.pointerDown(
      block('Standup'),
      pointer('mouse', x('2026-09-22'), y(540))
    )
    fireEvent.pointerMove(
      window,
      pointer('mouse', x('2026-09-22'), y(600), { altKey: true })
    )
    expect(ghost()!.querySelector('[aria-label="Copy"]')).not.toBeNull()
    // The original stays whole: it is not going anywhere.
    expect(block('Standup').classList.contains('opacity-40')).toBe(false)
    fireEvent.pointerUp(
      window,
      pointer('mouse', x('2026-09-22'), y(600), { altKey: true })
    )
    expect(onMove).toHaveBeenCalledWith({
      key: 'e1',
      start: at('2026-09-22', 600),
      finish: at('2026-09-22', 660),
      copy: true,
    })
  })

  it('moves a block to the calendar whose row it is dropped on, keeping its span', () => {
    const row = document.createElement('div')
    row.dataset.drop = 'cal-2'
    document.body.appendChild(row)
    Object.defineProperty(document, 'elementFromPoint', {
      configurable: true,
      value: (px: number) => (px < 0 ? row : null),
    })
    try {
      const { onMove } = show([meeting])
      fireEvent.pointerDown(
        block('Standup'),
        pointer('mouse', x('2026-09-22'), y(540))
      )
      fireEvent.pointerMove(window, pointer('mouse', -20, 300))
      expect(row.hasAttribute('data-over')).toBe(true)
      fireEvent.pointerUp(window, pointer('mouse', -20, 300))
      expect(row.hasAttribute('data-over')).toBe(false)
      expect(onMove).toHaveBeenCalledWith({
        key: 'e1',
        start: meeting.start,
        finish: meeting.finish,
        calendar: 'cal-2',
        copy: false,
      })
    } finally {
      row.remove()
      delete (document as { elementFromPoint?: unknown }).elementFromPoint
    }
  })
})

describe('TimeGrid resting at an edge', () => {
  it('turns the page after a hold at the side, and again for each hold it stays', () => {
    const { onStep } = show([meeting])
    fireEvent.pointerDown(
      block('Standup'),
      pointer('mouse', x('2026-09-22'), y(540))
    )
    fireEvent.pointerMove(window, pointer('mouse', LEFT + 4, y(300)))
    frame()
    expect(onStep).not.toHaveBeenCalled()
    act(() => {
      vi.advanceTimersByTime(PAGE_HOLD_MS)
    })
    frame()
    expect(onStep).toHaveBeenCalledTimes(1)
    expect(onStep).toHaveBeenLastCalledWith(-1)
    frame()
    expect(onStep).toHaveBeenCalledTimes(1)
    act(() => {
      vi.advanceTimersByTime(PAGE_HOLD_MS)
    })
    frame()
    expect(onStep).toHaveBeenCalledTimes(2)
    // Away from the edge the count starts over.
    fireEvent.pointerMove(window, pointer('mouse', x('2026-09-24'), y(300)))
    frame()
    act(() => {
      vi.advanceTimersByTime(PAGE_HOLD_MS)
    })
    frame()
    expect(onStep).toHaveBeenCalledTimes(2)
    fireEvent.pointerUp(window, pointer('mouse', x('2026-09-24'), y(300)))
  })

  it('scrolls the day while the pointer rests near the bottom', () => {
    show([meeting])
    const scroller = screen.getByTestId('scroller')
    scroller.scrollTop = 0
    fireEvent.pointerDown(
      block('Standup'),
      pointer('mouse', x('2026-09-22'), y(540))
    )
    fireEvent.pointerMove(window, pointer('mouse', x('2026-09-22'), TOP + 590))
    frame()
    frame()
    expect(scroller.scrollTop).toBeGreaterThan(0)
    fireEvent.pointerUp(window, pointer('mouse', x('2026-09-22'), TOP + 590))
  })
})

describe('TimeGrid keyboard', () => {
  it('moves a focused block by a step with the arrows, drops it on Enter', () => {
    const { onMove } = show([meeting])
    const target = block('Standup')
    target.focus()
    fireEvent.keyDown(target, { key: 'ArrowDown' })
    expect(ghost()!.textContent).toMatch(/09:15 to 10:15/)
    expect(document.activeElement).toBe(ghost())
    fireEvent.keyDown(ghost()!, { key: 'ArrowRight' })
    fireEvent.keyDown(ghost()!, { key: 'Enter' })
    expect(onMove).toHaveBeenCalledWith({
      key: 'e1',
      start: at('2026-09-23', 555),
      finish: at('2026-09-23', 615),
      copy: false,
    })
    expect(ghost()).toBeNull()
  })

  it('puts a lifted block back on Escape', () => {
    const { onMove } = show([meeting])
    const target = block('Standup')
    fireEvent.keyDown(target, { key: 'ArrowUp' })
    expect(ghost()).not.toBeNull()
    fireEvent.keyDown(ghost()!, { key: 'Escape' })
    expect(ghost()).toBeNull()
    expect(onMove).not.toHaveBeenCalled()
    expect(document.activeElement).toBe(block('Standup'))
  })

  it('moves the end with Shift and the arrows', () => {
    const { onMove } = show([meeting])
    const target = block('Standup')
    fireEvent.keyDown(target, { key: 'ArrowDown', shiftKey: true })
    expect(ghost()!.textContent).toMatch(/09:00 to 10:15/)
    fireEvent.keyDown(ghost()!, { key: 'Enter' })
    expect(onMove).toHaveBeenCalledWith({
      key: 'e1',
      start: at('2026-09-22', 540),
      finish: at('2026-09-22', 615),
    })
  })

  it('opens a block on Enter when nothing was lifted', () => {
    const { onMove, onSelect } = show([meeting])
    const target = block('Standup')
    fireEvent.keyDown(target, { key: 'Enter' })
    expect(onSelect).toHaveBeenCalledWith('e1', target)
    expect(onMove).not.toHaveBeenCalled()
  })

  it('asks for the next page when the arrows leave the shown days', () => {
    const { onStep } = show([meeting])
    fireEvent.keyDown(block('Standup'), { key: 'ArrowLeft' })
    expect(onStep).not.toHaveBeenCalled()
    fireEvent.keyDown(ghost()!, { key: 'ArrowLeft' })
    expect(onStep).toHaveBeenCalledWith(-1)
  })
})
