// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: Apache-2.0

import { describe, it, expect } from 'vitest'
import { moveItem, nearestSlotIndex, type Slot } from './reorder'

describe('moveItem', () => {
  it('moves the last item to the front', () => {
    expect(moveItem(['a', 'b', 'c', 'd'], 3, 0)).toEqual(['d', 'a', 'b', 'c'])
  })

  it('moves the first item to the end', () => {
    expect(moveItem(['a', 'b', 'c', 'd'], 0, 3)).toEqual(['b', 'c', 'd', 'a'])
  })

  it('moves an item one slot forward', () => {
    expect(moveItem(['a', 'b', 'c'], 0, 1)).toEqual(['b', 'a', 'c'])
  })

  it('moves an item one slot back', () => {
    expect(moveItem(['a', 'b', 'c'], 2, 1)).toEqual(['a', 'c', 'b'])
  })

  it('leaves the list alone when the item does not move', () => {
    expect(moveItem(['a', 'b', 'c'], 1, 1)).toEqual(['a', 'b', 'c'])
  })

  it('returns a new array rather than mutating the input', () => {
    const list = ['a', 'b', 'c']
    const result = moveItem(list, 2, 0)
    expect(result).not.toBe(list)
    expect(list).toEqual(['a', 'b', 'c'])
  })

  // A drag can outlive the list it started on: a file finishes uploading and is
  // dropped from the array while the pointer is still down. Clamping rather
  // than splicing at an out-of-range index keeps that from silently appending
  // an undefined hole to the list.
  it('clamps indexes that fall outside the list', () => {
    expect(moveItem(['a', 'b', 'c'], 5, 0)).toEqual(['c', 'a', 'b'])
    expect(moveItem(['a', 'b', 'c'], 0, 9)).toEqual(['b', 'c', 'a'])
    expect(moveItem(['a', 'b', 'c'], -1, 2)).toEqual(['b', 'c', 'a'])
  })

  it('handles empty and single-item lists', () => {
    expect(moveItem([], 0, 0)).toEqual([])
    expect(moveItem(['a'], 0, 0)).toEqual(['a'])
  })
})

describe('nearestSlotIndex', () => {
  // Two rows of three 100x100 tiles with a 20px gutter, as a wrapping grid
  // lays them out. Slot centres are at x = 50/170/290, y = 50/170.
  const grid: Slot[] = [
    { left: 0, top: 0, right: 100, bottom: 100 },
    { left: 120, top: 0, right: 220, bottom: 100 },
    { left: 240, top: 0, right: 340, bottom: 100 },
    { left: 0, top: 120, right: 100, bottom: 220 },
    { left: 120, top: 120, right: 220, bottom: 220 },
    { left: 240, top: 120, right: 340, bottom: 220 },
  ]

  it('picks the slot the pointer is inside', () => {
    expect(nearestSlotIndex(grid, 50, 50)).toBe(0)
    expect(nearestSlotIndex(grid, 290, 170)).toBe(5)
  })

  // The gutters between tiles are dead space. Falling back to "keep the last
  // target" there makes the item stick; nearest centre keeps it following the
  // pointer across the whole grid.
  it('picks the nearest slot when the pointer is in a gutter', () => {
    expect(nearestSlotIndex(grid, 110, 50)).toBe(0)
    expect(nearestSlotIndex(grid, 130, 50)).toBe(1)
    expect(nearestSlotIndex(grid, 50, 115)).toBe(3)
  })

  // Dragging out over the message box or past the last tile still has to
  // resolve to something, or the drop silently does nothing.
  it('picks the nearest edge slot when the pointer leaves the grid', () => {
    expect(nearestSlotIndex(grid, -500, -500)).toBe(0)
    expect(nearestSlotIndex(grid, 900, 900)).toBe(5)
    expect(nearestSlotIndex(grid, 290, -80)).toBe(2)
  })

  it('returns null when there are no slots', () => {
    expect(nearestSlotIndex([], 10, 10)).toBeNull()
  })
})
