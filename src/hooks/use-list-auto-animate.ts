// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: Apache-2.0

import { useCallback, useLayoutEffect, useRef } from 'react'
import { useAutoAnimate } from '@formkit/auto-animate/react'

const DEFAULT_DURATION = 180

/** The most items a list animates; a longer one is not watched at all. */
const LIMIT = 100

interface UseListAutoAnimateOptions {
  duration?: number
  easing?: string
  /** When true, sync without animating (e.g. collapsed sidebar or pagination). */
  disabled?: boolean
  /**
   * How many items the list holds. Over a hundred, auto-animate is not
   * attached: it watches every item for as long as the list is shown, polling
   * each one's position every two seconds, which held a tenth of a core for a
   * thousand contacts sitting idle. Disabling it does not stop that.
   */
  count: number
}

/**
 * AutoAnimate ref for list parents (sidebar menus, post lists).
 * Suppresses animation on first paint and while `disabled`, and is attached
 * only while the list holds a hundred items or fewer.
 */
export function useListAutoAnimate<T extends HTMLElement>({
  duration = DEFAULT_DURATION,
  easing = 'ease-out',
  disabled = false,
  count,
}: UseListAutoAnimateOptions): [
  (node: T | null) => void,
  ReturnType<typeof useAutoAnimate<T>>[1],
] {
  const [animated, setAnimationsEnabled] = useAutoAnimate<T>({
    duration,
    easing,
  })
  // A new ref when the list crosses the limit: React gives the old one null
  // and the new one the list, which detaches or attaches auto-animate.
  const long = count > LIMIT
  const listRef = useCallback(
    (node: T | null) => animated(long ? null : node),
    [animated, long]
  )
  const wasDisabledRef = useRef(false)

  useLayoutEffect(() => {
    if (disabled) {
      wasDisabledRef.current = true
      setAnimationsEnabled(false)
      return
    }

    if (wasDisabledRef.current) {
      wasDisabledRef.current = false
      setAnimationsEnabled(false)
      const id = requestAnimationFrame(() => setAnimationsEnabled(true))
      return () => cancelAnimationFrame(id)
    }

    setAnimationsEnabled(false)
    const id = requestAnimationFrame(() => setAnimationsEnabled(true))
    return () => cancelAnimationFrame(id)
  }, [disabled, setAnimationsEnabled])

  return [listRef, setAnimationsEnabled]
}
