// Copyright © 2026 Mochi OÜ
// SPDX-License-Identifier: Apache-2.0

import type { ReactNode } from 'react'
import { ArrowUp } from 'lucide-react'
import { cn } from '../lib/utils'

interface NewItemsPillProps {
  /** Number of pending items waiting to be merged. Pill is hidden when <= 0. */
  count: number
  /** Merge the pending items into the visible list and clear the count. */
  onClick: () => void
  label: ReactNode
  className?: string
}

export function NewItemsPill({
  count,
  onClick,
  label,
  className,
}: NewItemsPillProps) {
  if (count <= 0) return null

  return (
    <div
      className={cn(
        'pointer-events-none sticky top-0 z-20 flex justify-center pt-3 pb-2',
        className
      )}
    >
      <button
        type="button"
        onClick={onClick}
        aria-live="polite"
        className="bg-primary text-primary-foreground focus-visible:ring-ring pointer-events-auto inline-flex items-center gap-1.5 rounded-full px-4 py-1.5 text-sm font-medium shadow-lg ring-1 ring-black/5 transition hover:brightness-110 focus-visible:ring-2 focus-visible:outline-none"
      >
        <ArrowUp className="size-4" />
        {label}
      </button>
    </div>
  )
}
