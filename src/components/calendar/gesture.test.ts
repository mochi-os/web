// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: Apache-2.0

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  arm,
  Hold,
  hover,
  PAGE_HOLD_MS,
  POINTER_SLOP,
  scroll,
  swallow,
  target,
  TOUCH_HOLD_MS,
  TOUCH_SLOP,
} from './gesture'

const down = (pointerType: string) => ({
  pointerId: 7,
  pointerType,
  clientX: 100,
  clientY: 100,
})

const move = (clientX: number, clientY: number, pointerId = 7) =>
  new PointerEvent('pointermove', { pointerId, clientX, clientY })

beforeEach(() => {
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
})

describe('arm', () => {
  it('begins a mouse drag once the pointer has travelled the slop', () => {
    const begin = vi.fn()
    const tap = vi.fn()
    arm(down('mouse'), begin, tap)
    window.dispatchEvent(move(100 + POINTER_SLOP, 100))
    expect(begin).not.toHaveBeenCalled()
    window.dispatchEvent(move(100 + POINTER_SLOP + 1, 100))
    expect(begin).toHaveBeenCalledTimes(1)
    // Settled: later moves and the release do nothing more.
    window.dispatchEvent(move(200, 200))
    window.dispatchEvent(new PointerEvent('pointerup', { pointerId: 7 }))
    expect(begin).toHaveBeenCalledTimes(1)
    expect(tap).not.toHaveBeenCalled()
  })

  it('reports a tap when the pointer is released without dragging', () => {
    const begin = vi.fn()
    const tap = vi.fn()
    arm(down('mouse'), begin, tap)
    window.dispatchEvent(move(102, 101))
    window.dispatchEvent(new PointerEvent('pointerup', { pointerId: 7 }))
    expect(begin).not.toHaveBeenCalled()
    expect(tap).toHaveBeenCalledTimes(1)
  })

  it('begins a touch drag after the hold, but not if the finger moved first', () => {
    const begin = vi.fn()
    arm(down('touch'), begin)
    window.dispatchEvent(move(100 + TOUCH_SLOP, 100))
    vi.advanceTimersByTime(TOUCH_HOLD_MS)
    expect(begin).toHaveBeenCalledTimes(1)

    const scrolled = vi.fn()
    arm(down('touch'), scrolled)
    window.dispatchEvent(move(100 + TOUCH_SLOP + 1, 100))
    vi.advanceTimersByTime(TOUCH_HOLD_MS)
    expect(scrolled).not.toHaveBeenCalled()
  })

  it('ignores another pointer', () => {
    const begin = vi.fn()
    arm(down('mouse'), begin)
    window.dispatchEvent(move(300, 300, 8))
    expect(begin).not.toHaveBeenCalled()
  })

  it('can be abandoned', () => {
    const begin = vi.fn()
    const abandon = arm(down('touch'), begin)
    abandon()
    vi.advanceTimersByTime(TOUCH_HOLD_MS)
    window.dispatchEvent(move(300, 300))
    expect(begin).not.toHaveBeenCalled()
  })
})

describe('swallow', () => {
  it('eats the one click that follows a drop, and no more', () => {
    const seen = vi.fn()
    const button = document.createElement('button')
    button.addEventListener('click', seen)
    document.body.appendChild(button)
    swallow()
    button.click()
    expect(seen).not.toHaveBeenCalled()
    button.click()
    expect(seen).toHaveBeenCalledTimes(1)
    button.remove()
  })

  it('lets a later click through when none followed the drop', () => {
    const seen = vi.fn()
    const button = document.createElement('button')
    button.addEventListener('click', seen)
    document.body.appendChild(button)
    swallow()
    vi.advanceTimersByTime(0)
    button.click()
    expect(seen).toHaveBeenCalledTimes(1)
    button.remove()
  })
})

describe('Hold', () => {
  it('turns the page after the hold, again each hold, and forgets a left edge', () => {
    const hold = new Hold()
    expect(hold.step(1, 1000)).toBe(0)
    expect(hold.step(1, 1000 + PAGE_HOLD_MS - 1)).toBe(0)
    expect(hold.step(1, 1000 + PAGE_HOLD_MS)).toBe(1)
    expect(hold.step(1, 1000 + PAGE_HOLD_MS + 1)).toBe(0)
    expect(hold.step(1, 1000 + 2 * PAGE_HOLD_MS)).toBe(1)
    expect(hold.step(0, 1000 + 2 * PAGE_HOLD_MS + 1)).toBe(0)
    expect(hold.step(1, 5000)).toBe(0)
    expect(hold.step(1, 5000 + PAGE_HOLD_MS)).toBe(1)
  })

  it('starts over when the pointer crosses to the other edge', () => {
    const hold = new Hold()
    hold.step(-1, 0)
    expect(hold.step(1, PAGE_HOLD_MS)).toBe(0)
    expect(hold.step(1, 2 * PAGE_HOLD_MS)).toBe(1)
  })
})

describe('target and hover', () => {
  it('finds the marked ancestor under a point and lights only the current one', () => {
    const row = document.createElement('div')
    row.dataset.drop = 'cal-1'
    const label = document.createElement('span')
    row.appendChild(label)
    const other = document.createElement('div')
    other.dataset.drop = 'cal-2'
    document.body.append(row, other)
    Object.defineProperty(document, 'elementFromPoint', {
      configurable: true,
      value: (x: number) => (x < 50 ? label : x < 100 ? other : null),
    })
    try {
      expect(target(10, 10)).toBe(row)
      expect(target(200, 10)).toBeNull()
      hover(target(10, 10))
      expect(row.hasAttribute('data-over')).toBe(true)
      hover(target(60, 10))
      expect(row.hasAttribute('data-over')).toBe(false)
      expect(other.hasAttribute('data-over')).toBe(true)
      hover(null)
      expect(other.hasAttribute('data-over')).toBe(false)
    } finally {
      row.remove()
      other.remove()
      delete (document as { elementFromPoint?: unknown }).elementFromPoint
    }
  })
})

describe('scroll', () => {
  it('scrolls a box whose edge the pointer is near, faster the nearer, and not otherwise', () => {
    const box = document.createElement('div')
    vi.spyOn(box, 'getBoundingClientRect').mockReturnValue({
      top: 100,
      bottom: 500,
      left: 0,
      right: 100,
      width: 100,
      height: 400,
      x: 0,
      y: 100,
      toJSON: () => ({}),
    } as DOMRect)
    box.scrollTop = 100
    expect(scroll(box, 300)).toBe(false)
    expect(box.scrollTop).toBe(100)
    expect(scroll(box, 495)).toBe(true)
    const near = box.scrollTop - 100
    box.scrollTop = 100
    scroll(box, 460)
    const far = box.scrollTop - 100
    expect(near).toBeGreaterThan(far)
    expect(far).toBeGreaterThan(0)
    box.scrollTop = 100
    expect(scroll(box, 105)).toBe(true)
    expect(box.scrollTop).toBeLessThan(100)
  })
})
