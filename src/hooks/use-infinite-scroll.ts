// Copyright © 2026 Mochi OÜ
// SPDX-License-Identifier: Apache-2.0

import { useEffect, useRef } from 'react'

export interface UseInfiniteScrollOptions {
  hasMore: boolean
  isLoading: boolean
  onLoadMore: () => void
  rootMargin?: string
}

/**
 * Attach the returned ref to a sentinel element at the bottom of your list.
 * When it scrolls into view and hasMore is true, onLoadMore fires.
 */
export function useInfiniteScroll({
  hasMore,
  isLoading,
  onLoadMore,
  rootMargin = '200px',
}: UseInfiniteScrollOptions) {
  const sentinelRef = useRef<HTMLDivElement | null>(null)
  const onLoadMoreRef = useRef(onLoadMore)
  onLoadMoreRef.current = onLoadMore

  useEffect(() => {
    const node = sentinelRef.current
    if (!node) return
    if (!hasMore) return

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && !isLoading) {
          onLoadMoreRef.current()
        }
      },
      { rootMargin },
    )
    observer.observe(node)
    return () => observer.disconnect()
  }, [hasMore, isLoading, rootMargin])

  return sentinelRef
}
