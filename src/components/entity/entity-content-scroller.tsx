// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: Apache-2.0

/**
 * Internal shared component — not exported from lib/web index.
 * Used by entity-objects-page and entity-design-preview, so the design
 * preview scrolls a view exactly as the real page does.
 */
import type { ReactNode } from 'react'

interface EntityContentScrollerProps {
  layout: 'list' | 'board'
  /** Children go straight into the scroller, without the gutter wrapper. */
  bare?: boolean
  children: ReactNode
}

export function EntityContentScroller({
  layout,
  bare = false,
  children,
}: EntityContentScrollerProps) {
  const list = layout === 'list'
  return (
    <div
      data-slot='entity-content-scroll-area'
      // The list's side gutter is a margin on the scroller, not padding
      // inside it, so the pinned columns stop at the gutter instead of
      // sliding to the screen edge when the table scrolls sideways. min-h-0
      // lets the scroller shrink inside its flex column, so the table scrolls
      // here and the sticky header follows it.
      className={
        list
          ? 'flex-1 min-h-0 overflow-auto mx-4'
          : 'flex-1 min-h-0 overflow-x-auto'
      }
    >
      {bare ? (
        children
      ) : (
        <div className={list ? 'py-4' : 'px-4 w-fit min-w-full'}>
          {children}
        </div>
      )}
    </div>
  )
}
