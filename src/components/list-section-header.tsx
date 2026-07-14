// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: Apache-2.0

import type { DragEvent } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'
import { cn } from '../lib/utils'

export interface ListSectionHeaderProps {
  name: string
  colour?: string
  count: number
  isExpanded: boolean
  onToggle: () => void
  colSpan: number
  className?: string
  isDragOver?: boolean
  canAcceptDrop?: boolean
  onSectionDragOver?: (e: DragEvent) => void
  onSectionDrop?: (e: DragEvent) => void
  onSectionDragLeave?: () => void
}

export function ListSectionHeader({
  name,
  colour,
  count,
  isExpanded,
  onToggle,
  colSpan,
  className,
  isDragOver,
  canAcceptDrop,
  onSectionDragOver,
  onSectionDrop,
  onSectionDragLeave,
}: ListSectionHeaderProps) {
  return (
    <tr
      className={cn(
        'bg-muted/30 border-t border-border first:border-t-0 transition-colors',
        canAcceptDrop && isDragOver && 'bg-primary/15 ring-2 ring-inset ring-primary/40',
        className,
      )}
      onDragOver={canAcceptDrop ? onSectionDragOver : undefined}
      onDrop={canAcceptDrop ? onSectionDrop : undefined}
      onDragLeave={canAcceptDrop ? onSectionDragLeave : undefined}
    >
      <td colSpan={colSpan} className="px-2 py-2">
        <button
          type="button"
          onClick={onToggle}
          className="flex items-center gap-2 w-full text-start rounded-md px-1 py-0.5 hover:bg-hover transition-colors"
        >
          {isExpanded ? (
            <ChevronDown className="size-4 shrink-0 text-muted-foreground" />
          ) : (
            <ChevronRight className="size-4 shrink-0 text-muted-foreground rtl:rotate-180" />
          )}
          {colour ? (
            <span
              className="size-2.5 rounded-full shrink-0 ring-1 ring-border/50"
              style={{ backgroundColor: colour }}
            />
          ) : null}
          <span className="font-medium text-sm text-foreground">{name}</span>
          <span className="text-xs text-muted-foreground tabular-nums">{count}</span>
        </button>
      </td>
    </tr>
  )
}
