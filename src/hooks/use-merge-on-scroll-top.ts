// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: Apache-2.0

import { useEffect, useRef } from 'react'

interface UseMergeOnScrollTopOptions {
  /** The scrollable element. Omit to watch the window. */
  scrollRef?: React.RefObject<HTMLElement | null>
  /** Only watch while there is something pending to merge. */
  active: boolean
  /** Called once when the top is reached with items pending. */
  onMerge: () => void
  /** Distance from the top (px) that still counts as "at the top". */
  threshold?: number
}

export function useMergeOnScrollTop({
  scrollRef,
  active,
  onMerge,
  threshold = 8,
}: UseMergeOnScrollTopOptions) {
  const onMergeRef = useRef(onMerge)
  onMergeRef.current = onMerge

  useEffect(() => {
    if (!active) return

    const el = scrollRef?.current ?? null
    const target: HTMLElement | Window = el ?? window
    let merged = false

    const atTop = () => (el ? el.scrollTop : window.scrollY) <= threshold

    const check = () => {
      if (merged) return
      if (atTop()) {
        merged = true
        onMergeRef.current()
      }
    }

    // Handle the case where we're already at the top when items arrive.
    check()

    target.addEventListener('scroll', check, { passive: true })
    return () => target.removeEventListener('scroll', check)
  }, [active, scrollRef, threshold])
}
