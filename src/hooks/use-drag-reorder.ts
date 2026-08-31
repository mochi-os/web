// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: Apache-2.0

import { useCallback, useEffect, useRef, useState, type RefCallback } from 'react'
import { nearestSlotIndex, type Slot } from '../lib/reorder'
import { useListAutoAnimate } from './use-list-auto-animate'

/** Mouse and pen drags start once the pointer has travelled this far. */
const POINTER_SLOP = 5
/** Touch drags start after a hold, so a swipe still scrolls the page. */
const TOUCH_HOLD_MS = 250
/** Movement during the hold that means the finger is scrolling, not dragging. */
const TOUCH_SLOP = 10
/** Distance from a scroll edge at which the list starts following the pointer. */
const AUTO_SCROLL_EDGE = 56
/** Pixels per frame at the very edge, tapering to zero at AUTO_SCROLL_EDGE. */
const AUTO_SCROLL_SPEED = 14
/** How long the other tiles take to shift into their new places. */
const SHIFT_MS = 160
/** Anything inside a tile that owns its own press, such as the remove button. */
const INTERACTIVE = ['button', 'a', 'input', 'textarea'].join(',')

type Gesture = {
  pointerId: number
  pointerType: string
  /** Slot the dragged item started in, so a cancelled drag can put it back. */
  originIndex: number
  /** Slot the dragged item is in right now; live moves keep this current. */
  index: number
  startX: number
  startY: number
  active: boolean
  holdTimer: ReturnType<typeof setTimeout> | null
  slots: Slot[]
}

export type UseDragReorderOptions = {
  /** Number of items rendered right now. */
  count: number
  /**
   * Move the item at `from` to `to`. Called as the pointer crosses each slot,
   * not once at the end, so the list on screen is always the live order.
   */
  onMove: (from: number, to: number) => void
  /**
   * The drag finished in a new order. Called once on release, never for a
   * cancelled drag or one that ended where it began. Read the order from your
   * own state.
   */
  onCommit?: () => void
  /**
   * Veto a landing slot. Return false and the item stays put while the drag
   * carries on. Omit and every slot accepts.
   */
  canMove?: (from: number, to: number) => boolean
  /** Set false to leave the list static (a single item, or a save in flight). */
  enabled?: boolean
}

export type UseDragReorderResult = {
  /** Slot the dragged item currently occupies, or null when nothing is moving. */
  draggingIndex: number | null
  isDragging: boolean
  /** Spread onto the element that wraps the items. */
  getGroupProps: () => { ref: RefCallback<HTMLDivElement> }
  /** Spread onto each item. */
  getItemProps: (index: number) => {
    ref: RefCallback<HTMLElement>
    onPointerDown: (event: React.PointerEvent<HTMLElement>) => void
  }
}

/**
 * Drag-to-reorder for a wrapping grid, on mouse, pen and touch alike. Items
 * move under the pointer rather than on release. Targets are hit-tested against
 * the slot rectangles captured at drag start, never the live tiles, which
 * animate.
 */
export function useDragReorder({
  count,
  onMove,
  onCommit,
  canMove,
  enabled = true,
}: UseDragReorderOptions): UseDragReorderResult {
  const [draggingIndex, setDraggingIndex] = useState<number | null>(null)
  // Drives the window listeners, which live only for the length of a gesture.
  const [gestureLive, setGestureLive] = useState(false)

  const [autoAnimateRef] = useListAutoAnimate<HTMLDivElement>({
    duration: SHIFT_MS,
  })
  const containerRef = useRef<HTMLDivElement | null>(null)
  const itemsRef = useRef<(HTMLElement | null)[]>([])
  const gestureRef = useRef<Gesture | null>(null)
  const pointRef = useRef({ x: 0, y: 0 })
  const frameRef = useRef<number | null>(null)
  const scrollerRef = useRef<HTMLElement | null>(null)

  // Read through refs inside the listeners: they are attached for the length
  // of a gesture and must not answer with the render that started it.
  const onMoveRef = useRef(onMove)
  const onCommitRef = useRef(onCommit)
  const canMoveRef = useRef(canMove)
  const countRef = useRef(count)
  const enabledRef = useRef(enabled)
  useEffect(() => {
    onMoveRef.current = onMove
    onCommitRef.current = onCommit
    canMoveRef.current = canMove
    countRef.current = count
    enabledRef.current = enabled
  })

  useEffect(() => {
    itemsRef.current.length = count
  }, [count])

  const setContainer = useCallback<RefCallback<HTMLDivElement>>(
    (element) => {
      containerRef.current = element
      autoAnimateRef(element)
    },
    [autoAnimateRef]
  )

  const preventScroll = useCallback((event: TouchEvent) => {
    event.preventDefault()
  }, [])

  /**
   * The pointerup that drops a drag is followed by a browser-synthesized click
   * on the common ancestor of the gesture's two ends. Any clickable ancestor -
   * a card that navigates, a row that selects - would take the drop for a
   * click, so swallow the one click that follows a drop. Only a drop arms
   * this: the other endings see no pointerup (pointercancel, unmount) or one
   * far later (Escape, then release), where the next click is the user's own.
   * The listener also dies on a timer, for the environments and edge cases
   * where the browser elects not to synthesize the click at all.
   */
  const suppressClick = useCallback(() => {
    const swallow = (event: MouseEvent) => {
      event.preventDefault()
      event.stopPropagation()
    }
    window.addEventListener('click', swallow, { capture: true, once: true })
    setTimeout(
      () => window.removeEventListener('click', swallow, { capture: true }),
      0
    )
  }, [])

  /**
   * `drop` keeps the new order and commits, `cancel` puts the item back,
   * `discard` abandons a gesture that never became a drag.
   */
  const stop = useCallback(
    (outcome: 'drop' | 'cancel' | 'discard') => {
      const gesture = gestureRef.current
      gestureRef.current = null

      if (gesture?.holdTimer) clearTimeout(gesture.holdTimer)
      if (frameRef.current !== null) cancelAnimationFrame(frameRef.current)
      frameRef.current = null
      scrollerRef.current = null

      document.removeEventListener('touchmove', preventScroll)
      document.body.style.removeProperty('user-select')
      document.body.style.removeProperty('cursor')

      const moved = Boolean(gesture?.active) && gesture!.index !== gesture!.originIndex
      if (moved && outcome === 'cancel') {
        onMoveRef.current(gesture!.index, gesture!.originIndex)
      }
      if (moved && outcome === 'drop') {
        onCommitRef.current?.()
      }
      if (outcome === 'drop' && gesture?.active) suppressClick()
      setDraggingIndex(null)
      setGestureLive(false)
    },
    [preventScroll, suppressClick]
  )

  /** Slot under the pointer right now, in the coordinates the snapshot uses. */
  const updateTarget = useCallback(() => {
    const gesture = gestureRef.current
    const container = containerRef.current
    if (!gesture?.active || !container) return

    // Re-read the container each frame rather than caching it: auto-scrolling
    // moves the grid under a pointer that may be standing still, and a cached
    // origin would freeze the target where the drag began.
    const bounds = container.getBoundingClientRect()
    const target = nearestSlotIndex(
      gesture.slots,
      pointRef.current.x - bounds.left,
      pointRef.current.y - bounds.top
    )
    if (target === null || target === gesture.index) return
    // A refused slot leaves the gesture live rather than ending it: the pointer
    // is free to travel back over its own block and carry on reordering there.
    if (canMoveRef.current?.(gesture.index, target) === false) return

    onMoveRef.current(gesture.index, target)
    gesture.index = target
    setDraggingIndex(target)
  }, [])

  const autoScroll = useCallback(() => {
    const scroller = scrollerRef.current
    if (!scroller) return

    // The page scroller's own box is the whole document, so its edges are the
    // viewport's, not its rectangle's. A dialog's scroller uses its own box.
    const bounds =
      scroller === document.scrollingElement
        ? { top: 0, bottom: window.innerHeight }
        : scroller.getBoundingClientRect()
    const fromTop = pointRef.current.y - bounds.top
    const fromBottom = bounds.bottom - pointRef.current.y

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
  }, [])

  const tick = useCallback(() => {
    if (!gestureRef.current?.active) return
    autoScroll()
    updateTarget()
    frameRef.current = requestAnimationFrame(tick)
  }, [autoScroll, updateTarget])

  const activate = useCallback(() => {
    const gesture = gestureRef.current
    const container = containerRef.current
    if (!gesture || !container) {
      stop('discard')
      return
    }

    const bounds = container.getBoundingClientRect()
    gesture.slots = itemsRef.current
      .slice(0, countRef.current)
      .map((element) => {
        const rect = element?.getBoundingClientRect()
        return {
          left: (rect?.left ?? 0) - bounds.left,
          top: (rect?.top ?? 0) - bounds.top,
          right: (rect?.right ?? 0) - bounds.left,
          bottom: (rect?.bottom ?? 0) - bounds.top,
        }
      })
    gesture.active = true
    scrollerRef.current = scrollableAncestor(container)

    if (gesture.pointerType === 'touch') {
      // Non-passive, and attached only now: the hold has already proved the
      // finger is not scrolling, and a browser ignores preventDefault once a
      // scroll is under way.
      document.addEventListener('touchmove', preventScroll, { passive: false })
    }
    document.body.style.setProperty('user-select', 'none')
    document.body.style.setProperty('cursor', 'grabbing')

    setDraggingIndex(gesture.index)
    frameRef.current = requestAnimationFrame(tick)
  }, [preventScroll, stop, tick])

  const handlePointerDown = useCallback(
    (index: number, event: React.PointerEvent<HTMLElement>) => {
      if (!enabledRef.current || countRef.current < 2) return
      if (event.pointerType === 'mouse' && event.button !== 0) return
      if (gestureRef.current) return
      // Leave the remove button and anything else clickable to their own job.
      if ((event.target as HTMLElement).closest(INTERACTIVE)) return

      pointRef.current = { x: event.clientX, y: event.clientY }
      gestureRef.current = {
        pointerId: event.pointerId,
        pointerType: event.pointerType,
        originIndex: index,
        index,
        startX: event.clientX,
        startY: event.clientY,
        active: false,
        holdTimer: null,
        slots: [],
      }
      if (event.pointerType === 'touch') {
        gestureRef.current.holdTimer = setTimeout(activate, TOUCH_HOLD_MS)
      }
      setGestureLive(true)
    },
    [activate]
  )

  useEffect(() => {
    if (!gestureLive) return

    const onPointerMove = (event: PointerEvent) => {
      const gesture = gestureRef.current
      if (!gesture || event.pointerId !== gesture.pointerId) return

      pointRef.current = { x: event.clientX, y: event.clientY }
      if (gesture.active) return

      const travelled = Math.hypot(
        event.clientX - gesture.startX,
        event.clientY - gesture.startY
      )
      if (gesture.pointerType === 'touch') {
        // Moving before the hold expires is a scroll, so let the page have it.
        if (travelled > TOUCH_SLOP) stop('discard')
        return
      }
      if (travelled > POINTER_SLOP) activate()
    }

    const onPointerUp = (event: PointerEvent) => {
      const gesture = gestureRef.current
      if (!gesture || event.pointerId !== gesture.pointerId) return
      // The live moves already left the list in its final order.
      stop('drop')
    }

    const onPointerCancel = (event: PointerEvent) => {
      const gesture = gestureRef.current
      if (!gesture || event.pointerId !== gesture.pointerId) return
      stop('cancel')
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') stop('cancel')
    }

    window.addEventListener('pointermove', onPointerMove)
    window.addEventListener('pointerup', onPointerUp)
    window.addEventListener('pointercancel', onPointerCancel)
    window.addEventListener('keydown', onKeyDown)

    return () => {
      window.removeEventListener('pointermove', onPointerMove)
      window.removeEventListener('pointerup', onPointerUp)
      window.removeEventListener('pointercancel', onPointerCancel)
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [gestureLive, activate, stop])

  // Unmounting mid-drag must not leave the body unselectable or a frame queued.
  const stopRef = useRef(stop)
  useEffect(() => {
    stopRef.current = stop
  }, [stop])
  useEffect(() => () => stopRef.current('discard'), [])

  const getItemProps = useCallback(
    (index: number) => ({
      ref: ((element: HTMLElement | null) => {
        itemsRef.current[index] = element
      }) as RefCallback<HTMLElement>,
      onPointerDown: (event: React.PointerEvent<HTMLElement>) =>
        handlePointerDown(index, event),
    }),
    [handlePointerDown]
  )

  const getGroupProps = useCallback(
    () => ({ ref: setContainer }),
    [setContainer]
  )

  return {
    draggingIndex,
    isDragging: draggingIndex !== null,
    getGroupProps,
    getItemProps,
  }
}

/**
 * Nearest ancestor that actually scrolls, falling back to the page itself.
 */
function scrollableAncestor(element: HTMLElement): HTMLElement | null {
  let node = element.parentElement
  while (node) {
    const { overflowY } = getComputedStyle(node)
    if (
      (overflowY === 'auto' || overflowY === 'scroll') &&
      node.scrollHeight > node.clientHeight
    ) {
      return node
    }
    node = node.parentElement
  }
  return document.scrollingElement as HTMLElement | null
}
