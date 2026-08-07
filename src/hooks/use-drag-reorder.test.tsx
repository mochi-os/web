// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: Apache-2.0

// The behaviour under test is that the list reorders LIVE, as the pointer
// crosses each slot, and that a touch drag only starts after a hold — a finger
// that moves straight away is scrolling the dialog, not moving a photo.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { act, render, screen, fireEvent } from '@testing-library/react'
import { useState } from 'react'
import { useDragReorder } from './use-drag-reorder'
import { moveItem } from '../lib/reorder'

const TILE = 100
const GAP = 20
const PER_ROW = 3
/** Comfortably past TOUCH_HOLD_MS in the hook. */
const TOUCH_HOLD = 300

/**
 * Fake only the timers the hold uses. Vitest fakes requestAnimationFrame too
 * by default, which would swallow the frames these tests drive by hand.
 */
function useHoldTimers() {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
}

/** Grid geometry for a tile index, matching the layout the tests assert on. */
function tileRect(index: number) {
  const column = index % PER_ROW
  const row = Math.floor(index / PER_ROW)
  const left = column * (TILE + GAP)
  const top = row * (TILE + GAP)
  return {
    left,
    top,
    right: left + TILE,
    bottom: top + TILE,
    width: TILE,
    height: TILE,
    x: left,
    y: top,
    toJSON: () => ({}),
  } as DOMRect
}

function List({ initial, onOrder }: { initial: string[]; onOrder: (o: string[]) => void }) {
  const [items, setItems] = useState(initial)
  const { draggingIndex, getGroupProps, getItemProps } = useDragReorder({
    count: items.length,
    onMove: (from, to) =>
      setItems((current) => {
        const next = moveItem(current, from, to)
        onOrder(next)
        return next
      }),
  })

  return (
    <div data-testid='group' {...getGroupProps()}>
      {items.map((item, index) => (
        <div
          key={item}
          data-testid={`tile-${item}`}
          data-slot-index={index}
          data-dragging={draggingIndex === index ? 'true' : undefined}
          {...getItemProps(index)}
        >
          {item}
          <button type='button'>remove</button>
        </div>
      ))}
    </div>
  )
}

let frames: FrameRequestCallback[]

/** Run one animation frame; the hook re-targets and auto-scrolls per frame. */
function flushFrame() {
  const queued = frames
  frames = []
  act(() => {
    queued.forEach((frame) => frame(performance.now()))
  })
}

beforeEach(() => {
  frames = []
  vi.stubGlobal('requestAnimationFrame', (frame: FrameRequestCallback) => {
    frames.push(frame)
    return frames.length
  })
  vi.stubGlobal('cancelAnimationFrame', () => {})

  // jsdom does no layout, so every rectangle the hook measures is stubbed:
  // the group sits at the origin, and each tile is placed by its slot index.
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(
    function (this: HTMLElement) {
      const slot = this.getAttribute('data-slot-index')
      if (slot !== null) return tileRect(Number(slot))
      return {
        left: 0,
        top: 0,
        right: 340,
        bottom: 220,
        width: 340,
        height: 220,
        x: 0,
        y: 0,
        toJSON: () => ({}),
      } as DOMRect
    }
  )
})

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

function pointer(type: string, x: number, y: number, extra: object = {}) {
  return { pointerId: 1, pointerType: type, button: 0, clientX: x, clientY: y, ...extra }
}

describe('useDragReorder', () => {
  it('moves the last tile to the front as the pointer crosses the slots', () => {
    const orders: string[][] = []
    render(<List initial={['a', 'b', 'c', 'd']} onOrder={(o) => orders.push(o)} />)

    // Grab 'd', which sits in slot 3 — first column of the second row.
    fireEvent.pointerDown(screen.getByTestId('tile-d'), pointer('mouse', 50, 170))
    // Past the slop, so the drag is live.
    fireEvent.pointerMove(window, pointer('mouse', 50, 160))
    // Over slot 0.
    fireEvent.pointerMove(window, pointer('mouse', 50, 50))
    flushFrame()

    expect(orders.at(-1)).toEqual(['d', 'a', 'b', 'c'])

    fireEvent.pointerUp(window, pointer('mouse', 50, 50))
    expect(orders.at(-1)).toEqual(['d', 'a', 'b', 'c'])
  })

  it('marks the dragged tile while it is moving and clears it on drop', () => {
    render(<List initial={['a', 'b', 'c']} onOrder={() => {}} />)

    fireEvent.pointerDown(screen.getByTestId('tile-a'), pointer('mouse', 50, 50))
    expect(screen.getByTestId('tile-a')).not.toHaveAttribute('data-dragging')

    fireEvent.pointerMove(window, pointer('mouse', 70, 50))
    expect(screen.getByTestId('tile-a')).toHaveAttribute('data-dragging', 'true')

    fireEvent.pointerUp(window, pointer('mouse', 70, 50))
    expect(screen.getByTestId('tile-a')).not.toHaveAttribute('data-dragging')
  })

  it('leaves a touch that moves straight away to scroll the page', () => {
    useHoldTimers()
    const orders: string[][] = []
    render(<List initial={['a', 'b', 'c']} onOrder={(o) => orders.push(o)} />)

    fireEvent.pointerDown(screen.getByTestId('tile-c'), pointer('touch', 290, 50))
    fireEvent.pointerMove(window, pointer('touch', 290, 130))
    act(() => {
      vi.advanceTimersByTime(TOUCH_HOLD)
    })
    fireEvent.pointerMove(window, pointer('touch', 50, 50))
    flushFrame()

    expect(orders).toEqual([])
    vi.useRealTimers()
  })

  it('starts a touch drag once the finger has been held still', () => {
    useHoldTimers()
    const orders: string[][] = []
    render(<List initial={['a', 'b', 'c']} onOrder={(o) => orders.push(o)} />)

    fireEvent.pointerDown(screen.getByTestId('tile-c'), pointer('touch', 290, 50))
    act(() => {
      vi.advanceTimersByTime(TOUCH_HOLD)
    })
    fireEvent.pointerMove(window, pointer('touch', 50, 50))
    flushFrame()

    expect(orders.at(-1)).toEqual(['c', 'a', 'b'])
    vi.useRealTimers()
  })

  it('puts the tile back when the drag is cancelled with Escape', () => {
    const orders: string[][] = []
    render(<List initial={['a', 'b', 'c']} onOrder={(o) => orders.push(o)} />)

    fireEvent.pointerDown(screen.getByTestId('tile-c'), pointer('mouse', 290, 50))
    fireEvent.pointerMove(window, pointer('mouse', 280, 50))
    fireEvent.pointerMove(window, pointer('mouse', 50, 50))
    flushFrame()
    expect(orders.at(-1)).toEqual(['c', 'a', 'b'])

    fireEvent.keyDown(window, { key: 'Escape' })
    expect(orders.at(-1)).toEqual(['a', 'b', 'c'])
  })

  it('ignores a press that lands on a control inside the tile', () => {
    const orders: string[][] = []
    render(<List initial={['a', 'b', 'c']} onOrder={(o) => orders.push(o)} />)

    const remove = screen.getByTestId('tile-c').querySelector('button')!
    fireEvent.pointerDown(remove, pointer('mouse', 290, 50))
    fireEvent.pointerMove(window, pointer('mouse', 50, 50))
    flushFrame()

    expect(orders).toEqual([])
  })

  it('does nothing with a single item', () => {
    const orders: string[][] = []
    render(<List initial={['a']} onOrder={(o) => orders.push(o)} />)

    fireEvent.pointerDown(screen.getByTestId('tile-a'), pointer('mouse', 50, 50))
    fireEvent.pointerMove(window, pointer('mouse', 200, 200))
    flushFrame()

    expect(orders).toEqual([])
  })
})
