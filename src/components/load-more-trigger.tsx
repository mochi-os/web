// Copyright © 2026 Mochi OÜ
// SPDX-License-Identifier: Apache-2.0

import { useEffect, useRef } from 'react'
import { Loader2 } from 'lucide-react'

interface LoadMoreTriggerProps {
  onLoadMore: () => void
  hasMore: boolean
  isLoading?: boolean
  /** Root margin for intersection observer (e.g., "200px" to trigger early) */
  rootMargin?: string
  className?: string
}

export function LoadMoreTrigger({
  onLoadMore,
  hasMore,
  isLoading = false,
  rootMargin = '200px',
  className,
}: LoadMoreTriggerProps) {
  const sentinelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const sentinel = sentinelRef.current
    if (!sentinel || !hasMore) return

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && hasMore && !isLoading) {
          onLoadMore()
        }
      },
      { rootMargin }
    )

    observer.observe(sentinel)
    return () => observer.disconnect()
  }, [hasMore, isLoading, onLoadMore, rootMargin])

  if (!hasMore) return null

  return (
    <div ref={sentinelRef} className={className}>
      {isLoading && (
        <div className="flex justify-center py-4">
          <Loader2 className="size-5 animate-spin text-muted-foreground" />
        </div>
      )}
    </div>
  )
}
