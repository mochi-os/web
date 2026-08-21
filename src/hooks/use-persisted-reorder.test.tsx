// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: Apache-2.0

// One save per drag, the list frozen while that save is in flight, and the old
// order back on screen if it fails.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { act, render, screen, fireEvent } from '@testing-library/react'
import { useState } from 'react'
import { usePersistedReorder } from './use-persisted-reorder'

const TILE = 100
const GAP = 20
const PER_ROW = 3

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

type Photo = { id: string }

/** Appends an item the way an upload finishing does, from outside the drag. */
let append: (id: string) => void = () => {}

function Gallery({
  initial,
  save,
  onError,
}: {
  initial: string[]
  save: (items: Photo[]) => Promise<unknown>
  onError?: (error: unknown) => void
}) {
  const [items, setItems] = useState<Photo[]>(initial.map((id) => ({ id })))
  append = (id) => setItems((current) => [...current, { id }])
  const { saving, draggingIndex, getGroupProps, getItemProps } = usePersistedReorder({
    items,
    setItems,
    save,
    onError,
  })

  return (
    <div data-testid='group' data-saving={saving ? 'true' : undefined} {...getGroupProps()}>
      {items.map((item, index) => (
        <div
          key={item.id}
          data-testid={`tile-${item.id}`}
          data-slot-index={index}
          data-dragging={draggingIndex === index ? 'true' : undefined}
          {...getItemProps(index)}
        >
          {item.id}
        </div>
      ))}
    </div>
  )
}

let frames: FrameRequestCallback[]

function flushFrame() {
  const queued = frames
  frames = []
  act(() => {
    queued.forEach((frame) => frame(performance.now()))
  })
}

/** Order of the tiles as they currently sit on screen. */
function order() {
  return Array.from(screen.getByTestId('group').children).map(
    (child) => child.textContent
  )
}

beforeEach(() => {
  frames = []
  vi.stubGlobal('requestAnimationFrame', (frame: FrameRequestCallback) => {
    frames.push(frame)
    return frames.length
  })
  vi.stubGlobal('cancelAnimationFrame', () => {})
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

function pointer(x: number, y: number) {
  return { pointerId: 1, pointerType: 'mouse', button: 0, clientX: x, clientY: y }
}

/** Drag the tile with the given label from the last slot of the row onto the first. */
function dragToFront(label: string) {
  fireEvent.pointerDown(screen.getByTestId(`tile-${label}`), pointer(290, 50))
  fireEvent.pointerMove(window, pointer(280, 50))
  fireEvent.pointerMove(window, pointer(50, 50))
  flushFrame()
  fireEvent.pointerUp(window, pointer(50, 50))
}

/** Let a settled save promise land. */
async function settle() {
  await act(async () => {})
}

describe('usePersistedReorder', () => {
  it('saves the new order once, after the drag rather than during it', async () => {
    const save = vi.fn().mockResolvedValue(undefined)
    render(<Gallery initial={['a', 'b', 'c']} save={save} />)

    dragToFront('c')
    await settle()

    expect(save).toHaveBeenCalledTimes(1)
    expect(save).toHaveBeenCalledWith([{ id: 'c' }, { id: 'a' }, { id: 'b' }])
    expect(order()).toEqual(['c', 'a', 'b'])
  })

  it('holds the list still while the save is in flight', async () => {
    let release: () => void = () => {}
    const save = vi.fn(
      () => new Promise<void>((resolve) => {
        release = resolve
      })
    )
    render(<Gallery initial={['a', 'b', 'c']} save={save} />)

    dragToFront('c')
    await settle()
    expect(screen.getByTestId('group')).toHaveAttribute('data-saving', 'true')

    // A second drag lands on a frozen list and changes nothing.
    fireEvent.pointerDown(screen.getByTestId('tile-a'), pointer(170, 50))
    fireEvent.pointerMove(window, pointer(50, 50))
    flushFrame()
    fireEvent.pointerUp(window, pointer(50, 50))
    await settle()
    expect(save).toHaveBeenCalledTimes(1)
    expect(order()).toEqual(['c', 'a', 'b'])

    await act(async () => {
      release()
    })
    expect(screen.getByTestId('group')).not.toHaveAttribute('data-saving')
  })

  it('puts the old order back when the save fails', async () => {
    const failure = new Error('nope')
    const save = vi.fn().mockRejectedValue(failure)
    const onError = vi.fn()
    render(<Gallery initial={['a', 'b', 'c']} save={save} onError={onError} />)

    dragToFront('c')
    await settle()

    expect(order()).toEqual(['a', 'b', 'c'])
    expect(onError).toHaveBeenCalledWith(failure)
  })

  it('rolls back to the last order the server took, not the first one it saw', async () => {
    const save = vi
      .fn()
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error('nope'))
    render(<Gallery initial={['a', 'b', 'c']} save={save} />)

    dragToFront('c')
    await settle()
    expect(order()).toEqual(['c', 'a', 'b'])

    // 'b' now sits in the last slot; move it to the front and fail the save.
    dragToFront('b')
    await settle()

    expect(order()).toEqual(['c', 'a', 'b'])
  })

  // An upload finishing is already on the server. A failed reorder afterwards
  // must not rewind past it and take the new photo off the screen.
  it('keeps an item added since the last save when a save fails', async () => {
    const save = vi.fn().mockRejectedValue(new Error('nope'))
    render(<Gallery initial={['a', 'b']} save={save} />)

    act(() => {
      append('c')
    })
    expect(order()).toEqual(['a', 'b', 'c'])

    dragToFront('c')
    await settle()

    expect(order()).toEqual(['a', 'b', 'c'])
  })

  it('saves nothing when the drag is cancelled', async () => {
    const save = vi.fn().mockResolvedValue(undefined)
    render(<Gallery initial={['a', 'b', 'c']} save={save} />)

    fireEvent.pointerDown(screen.getByTestId('tile-c'), pointer(290, 50))
    fireEvent.pointerMove(window, pointer(280, 50))
    fireEvent.pointerMove(window, pointer(50, 50))
    flushFrame()
    fireEvent.keyDown(window, { key: 'Escape' })
    await settle()

    expect(save).not.toHaveBeenCalled()
    expect(order()).toEqual(['a', 'b', 'c'])
  })
})
