// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: Apache-2.0

import { useEffect, useRef } from 'react'
import { Loader2 } from 'lucide-react'
import { cn } from '../lib/utils'

interface LoadMoreTriggerProps {
  onLoadMore: () => void
  hasMore: boolean
  isLoading?: boolean
  /** Root margin for intersection observer (e.g., "200px" to trigger early) */
  rootMargin?: string
  /**
   * The scroll container the list lives in, when the page owns one. Inside
   * the shell's sandboxed iframe the browser ignores rootMargin against the
   * viewport, so the sentinel only fires once it is fully inside the clip;
   * observing against the container restores the margin. The element must be
   * an ancestor of the trigger, and it must be the element that scrolls:
   * against a non-scrolling ancestor the sentinel is always inside the root's
   * box and every page loads at once. Pages that scroll through the layout
   * wrapper leave this unset. Anything that is not an ancestor falls back to
   * the viewport.
   */
  root?: React.RefObject<HTMLElement | null>
  className?: string
}

export function LoadMoreTrigger({
  onLoadMore,
  hasMore,
  isLoading = false,
  rootMargin = '200px',
  root,
  className,
}: LoadMoreTriggerProps) {
  const sentinelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const sentinel = sentinelRef.current
    if (!sentinel || !hasMore) return

    // Read the container here, not during render: the ref is empty until the
    // commit, and a parent's ref is attached after its children's layout
    // effects, so only a passive effect sees it on first mount. A container
    // that remounts takes this component with it, so the effect re-runs on
    // the new element.
    const scroller = root?.current

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && hasMore && !isLoading) {
          onLoadMore()
        }
      },
      {
        root: scroller && scroller.contains(sentinel) ? scroller : null,
        rootMargin,
      }
    )

    observer.observe(sentinel)
    return () => observer.disconnect()
  }, [hasMore, isLoading, onLoadMore, rootMargin, root])

  if (!hasMore) return null

  // The sentinel keeps a height of its own: scroll positions are whole
  // pixels while content heights are not, so an empty element at the end of
  // the list can sit a fraction of a pixel past the container's clip at full
  // scroll and never intersect.
  return (
    <div ref={sentinelRef} className={cn('min-h-2', className)}>
      {isLoading && (
        <div className="flex justify-center py-4">
          <Loader2 className="size-5 animate-spin text-muted-foreground" />
        </div>
      )}
    </div>
  )
}
