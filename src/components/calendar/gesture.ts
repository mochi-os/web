// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: Apache-2.0

/**
 * How a drag begins and behaves in the calendar grids, following the rules
 * the reorder hook uses: a mouse or pen drags once it has travelled a few
 * pixels, so a click stays a click; a finger drags after a short hold, so a
 * swipe stays a scroll.
 */
export const POINTER_SLOP = 5
export const TOUCH_HOLD_MS = 250
export const TOUCH_SLOP = 10
/** How close to a scroller's edge a drag scrolls it, and how fast. */
export const AUTO_SCROLL_EDGE = 56
export const AUTO_SCROLL_SPEED = 14
/** How close to a grid's edge a drag turns the page, after resting this long. */
export const PAGE_EDGE = 28
export const PAGE_HOLD_MS = 500

/** Where the pointer is, and whether Alt is held, which copies rather than moves. */
export interface Point {
  x: number
  y: number
  alt: boolean
}

interface Down {
  pointerId: number
  pointerType: string
  clientX: number
  clientY: number
}

/**
 * Watches a pointer that went down on something draggable until it either
 * becomes a drag or is released. `begin` runs when it does, with the move
 * that crossed the slop so the drag starts where the pointer now is, or
 * with nothing when a finger's hold expired in place; `tap` runs when the
 * pointer is released without ever dragging. A finger that moves before the
 * hold expires is scrolling, and the page keeps it. Returns a function that
 * abandons the watch.
 */
export function arm(
  down: Down,
  begin: (event: PointerEvent | null) => void,
  tap?: () => void
) {
  const { pointerId, pointerType, clientX, clientY } = down
  let timer: number | null = null
  const settle = () => {
    if (timer !== null) window.clearTimeout(timer)
    timer = null
    window.removeEventListener('pointermove', move)
    window.removeEventListener('pointerup', up)
    window.removeEventListener('pointercancel', cancel)
  }
  const move = (event: PointerEvent) => {
    if (event.pointerId !== pointerId) return
    const travelled = Math.hypot(
      event.clientX - clientX,
      event.clientY - clientY
    )
    if (pointerType === 'touch') {
      if (travelled > TOUCH_SLOP) settle()
      return
    }
    if (travelled > POINTER_SLOP) {
      settle()
      begin(event)
    }
  }
  const up = (event: PointerEvent) => {
    if (event.pointerId !== pointerId) return
    settle()
    tap?.()
  }
  const cancel = (event: PointerEvent) => {
    if (event.pointerId !== pointerId) return
    settle()
  }
  window.addEventListener('pointermove', move)
  window.addEventListener('pointerup', up)
  window.addEventListener('pointercancel', cancel)
  if (pointerType === 'touch') {
    timer = window.setTimeout(() => {
      settle()
      begin(null)
    }, TOUCH_HOLD_MS)
  }
  return settle
}

/**
 * The pointerup that drops a drag is followed by a click on whatever lies
 * beneath, which would open the block that was just dropped. Swallows the
 * one click that follows a drop; the listener dies on a timer for the cases
 * where no click comes.
 */
export function swallow() {
  const eat = (event: MouseEvent) => {
    event.preventDefault()
    event.stopPropagation()
  }
  window.addEventListener('click', eat, { capture: true, once: true })
  window.setTimeout(
    () => window.removeEventListener('click', eat, { capture: true }),
    0
  )
}

/**
 * Something outside the grid a block can be dropped on: an element carrying
 * `data-drop`, such as a calendar's row in the sidebar. The attribute's value
 * names the target.
 */
export function target(x: number, y: number): HTMLElement | null {
  if (typeof document.elementFromPoint !== 'function') return null
  const under = document.elementFromPoint(x, y)
  return (under?.closest('[data-drop]') as HTMLElement | null) ?? null
}

let hovered: HTMLElement | null = null

/** Marks the target a drag is over with `data-over`, clearing the last one. */
export function hover(element: HTMLElement | null) {
  if (hovered === element) return
  hovered?.removeAttribute('data-over')
  element?.setAttribute('data-over', '')
  hovered = element
}

/**
 * Scrolls a scroller when the pointer rests near its top or bottom edge,
 * faster the nearer it is; true when it moved.
 */
export function scroll(scroller: HTMLElement, y: number): boolean {
  const bounds = scroller.getBoundingClientRect()
  const fromTop = y - bounds.top
  const fromBottom = bounds.bottom - y
  const before = scroller.scrollTop
  if (fromTop < AUTO_SCROLL_EDGE) {
    const ratio = Math.min(1, (AUTO_SCROLL_EDGE - fromTop) / AUTO_SCROLL_EDGE)
    scroller.scrollTop -= AUTO_SCROLL_SPEED * ratio
  } else if (fromBottom < AUTO_SCROLL_EDGE) {
    const ratio = Math.min(
      1,
      (AUTO_SCROLL_EDGE - fromBottom) / AUTO_SCROLL_EDGE
    )
    scroller.scrollTop += AUTO_SCROLL_SPEED * ratio
  }
  return scroller.scrollTop !== before
}

/**
 * A page turned by resting a drag at the grid's edge: the first turn comes
 * after the pointer has rested there for the hold, and another each hold
 * for as long as it stays. Leaving the edge, or crossing to the other, starts
 * the count again.
 */
export class Hold {
  private since: number | null = null
  private direction = 0

  /** `direction` is 0 away from any edge; returns the page to turn now, or 0. */
  step(direction: number, now: number): number {
    if (direction !== this.direction) {
      this.direction = direction
      this.since = direction === 0 ? null : now
      return 0
    }
    if (this.since !== null && now - this.since >= PAGE_HOLD_MS) {
      this.since = now
      return direction
    }
    return 0
  }

  reset() {
    this.since = null
    this.direction = 0
  }
}
