// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: Apache-2.0

import type { HTMLAttributes } from 'react'
import { cn } from '../../lib/utils'

// The one place that knows where a pinned bar sits: under the page header,
// whose height PageHeader measures into --page-header-height. A page with no
// PageHeader leaves the variable unset and the bar pins at the top instead.
const stickyBarClass =
  'bg-background sticky top-[calc(var(--sticky-top,0px)+var(--page-header-height,0px))] z-20'

// Keeps tabs, pickers and other controls in view while a long page scrolls
// under them. It must be a direct child of the tall column it belongs to:
// sticky only holds for as long as its parent is on screen. No ancestor
// between it and the page may set overflow, or it stops sticking.
export function StickyBar({
  className,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      data-slot='sticky-bar'
      className={cn(stickyBarClass, className)}
      {...props}
    />
  )
}
