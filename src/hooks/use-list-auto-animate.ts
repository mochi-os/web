// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: Apache-2.0

import { useLayoutEffect, useRef } from 'react'
import { useAutoAnimate } from '@formkit/auto-animate/react'

const DEFAULT_DURATION = 180

interface UseListAutoAnimateOptions {
  duration?: number
  easing?: string
  /** When true, sync without animating (e.g. collapsed sidebar or pagination). */
  disabled?: boolean
}

/**
 * AutoAnimate ref for list parents (sidebar menus, post lists).
 * Suppresses animation on first paint and while `disabled`.
 */
export function useListAutoAnimate<T extends HTMLElement>({
  duration = DEFAULT_DURATION,
  easing = 'ease-out',
  disabled = false,
}: UseListAutoAnimateOptions = {}): [
  ReturnType<typeof useAutoAnimate<T>>[0],
  ReturnType<typeof useAutoAnimate<T>>[1],
] {
  const [listRef, setAnimationsEnabled] = useAutoAnimate<T>({
    duration,
    easing,
  })
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
