// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: Apache-2.0

import * as React from 'react'
import { cn } from '../../lib/utils'
import { CopyButton } from './copy-button'

interface DataChipProps {
  value: string
  /** Shown before the value; carries its own punctuation, as each locale wants it. */
  label?: string
  icon?: React.ReactNode
  copyable?: boolean
  copyButtonMode?: 'hover' | 'always'
  /**
   * Overflow behaviour: 'end' (default) CSS-ellipsis; 'middle' inserts "..."
   * between the first and last 10 characters over 24; 'none' wraps with
   * `break-all` so long ids stay readable.
   */
  truncate?: 'end' | 'middle' | 'none'
  className?: string
  chipClassName?: string
}

function middleTruncate(value: string): string {
  if (value.length <= 24) {
    return value
  }
  const start = value.slice(0, 10)
  const end = value.slice(-10)
  return `${start}...${end}`
}

export function DataChip({
  value,
  label,
  icon,
  copyable = true,
  copyButtonMode = 'hover',
  truncate = 'end',
  className,
  chipClassName,
}: DataChipProps) {
  const displayValue = truncate === 'middle' ? middleTruncate(value) : value

  return (
    <div
      className={cn(
        'flex items-center gap-1.5 min-w-0 group/chip',
        truncate === 'none' ? 'flex-wrap' : 'overflow-hidden',
        className,
      )}
    >
      <div
        className={cn(
          'bg-surface-2 text-foreground/90 font-mono text-[13px] px-2 py-0.5 rounded-md border border-border flex items-center gap-1.5 transition-[background-color,color,border-color] group-hover/chip:bg-surface-3 group-hover/chip:border-border-strong group-hover/chip:text-foreground max-w-full min-w-0',
          chipClassName
        )}
      >
        {icon}
        {label && <span className='text-muted-foreground font-sans font-normal'>{label}</span>}
        <span
          className={cn(
            'min-w-0',
            truncate === 'end' && 'truncate',
            truncate === 'none' && 'break-all',
          )}
          title={value}
        >
          {displayValue}
        </span>
      </div>
      {copyable && (
        <div
          className={cn(
            'transition-opacity',
            copyButtonMode === 'always'
              ? 'opacity-100'
              : 'opacity-0 group-hover/chip:opacity-100 group-focus-within/chip:opacity-100 [@media(hover:none)]:opacity-100'
          )}
        >
          <CopyButton value={value} />
        </div>
      )}
    </div>
  )
}
