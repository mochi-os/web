// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: Apache-2.0

/**
 * Move one item to another position, shifting what lies between. Returns a new
 * array; indexes are clamped, so a stale index cannot splice at a hole.
 */
export function moveItem<T>(list: readonly T[], from: number, to: number): T[] {
  const result = [...list]
  if (result.length < 2) return result

  const last = result.length - 1
  const source = Math.min(Math.max(from, 0), last)
  const target = Math.min(Math.max(to, 0), last)
  if (source === target) return result

  const [moved] = result.splice(source, 1)
  result.splice(target, 0, moved)
  return result
}

/** A slot rectangle, in coordinates relative to the list container. */
export type Slot = {
  left: number
  top: number
  right: number
  bottom: number
}

/**
 * Index of the slot nearest a point, centre to centre. Slots are the grid
 * positions snapshotted at drag start, not the moving tiles; nearest-centre
 * rather than containment, so a pointer in a gutter or off the grid still
 * resolves.
 */
export function nearestSlotIndex(
  slots: readonly Slot[],
  x: number,
  y: number
): number | null {
  let nearest: number | null = null
  let shortest = Infinity

  slots.forEach((slot, index) => {
    const dx = (slot.left + slot.right) / 2 - x
    const dy = (slot.top + slot.bottom) / 2 - y
    const distance = dx * dx + dy * dy
    if (distance < shortest) {
      shortest = distance
      nearest = index
    }
  })

  return nearest
}
