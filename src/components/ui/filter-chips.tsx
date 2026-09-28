// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: Apache-2.0

import * as React from 'react'
import * as RadioGroupPrimitive from '@radix-ui/react-radio-group'
import { cn } from '../../lib/utils'

// A row of pills of which exactly one is on: the list filters above a list
// (All, Unread, Groups). Built on the radio group so a chip is a radio, arrow
// keys move between chips, and Tab enters and leaves the row as one stop.
// Labels come from the caller, so this adds no strings to any catalog.
function FilterChips({
  className,
  ...props
}: React.ComponentProps<typeof RadioGroupPrimitive.Root>) {
  return (
    <RadioGroupPrimitive.Root
      data-slot='filter-chips'
      orientation='horizontal'
      className={cn('flex flex-wrap gap-1.5', className)}
      {...props}
    />
  )
}

type FilterChipProps = React.ComponentProps<typeof RadioGroupPrimitive.Item> & {
  /** Shown after the label; nothing is shown for 0 or undefined. */
  count?: React.ReactNode
}

function FilterChip({ className, count, children, ...props }: FilterChipProps) {
  return (
    <RadioGroupPrimitive.Item
      data-slot='filter-chip'
      className={cn(
        'inline-flex h-7 shrink-0 items-center gap-1 whitespace-nowrap rounded-full border px-3 text-xs font-medium transition-colors outline-none',
        'focus-visible:ring-ring/50 focus-visible:ring-[3px]',
        'disabled:pointer-events-none disabled:opacity-50',
        'border-border text-muted-foreground hover:bg-hover hover:text-foreground',
        'data-[state=checked]:border-primary/40 data-[state=checked]:bg-primary/15 data-[state=checked]:text-primary',
        className
      )}
      {...props}
    >
      {children}
      {/* The space keeps the accessible name "Unread 3" rather than
          "Unread3"; a flex container drops it from the layout. */}
      {count !== undefined && count !== 0 && count !== '' && (
        <>
          {' '}
          <span data-slot='filter-chip-count' className='tabular-nums'>
            {count}
          </span>
        </>
      )}
    </RadioGroupPrimitive.Item>
  )
}

export { FilterChips, FilterChip }
