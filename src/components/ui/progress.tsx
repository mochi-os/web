// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: Apache-2.0

import * as React from 'react'
import * as ProgressPrimitive from '@radix-ui/react-progress'
import { cn } from '../../lib/utils'

// The shadcn Progress on the individual Radix package, the way the rest of
// this folder adapts shadcn. It differs from the registry file in the height
// and track colour the old bars used, an indeterminate state, a fill that
// grows from the right in a right-to-left page, and `indicatorClassName`.

type ProgressProps = React.ComponentProps<typeof ProgressPrimitive.Root> & {
  /** Classes for the fill, for a colour or a duration. */
  indicatorClassName?: string
}

function Progress({
  className,
  indicatorClassName,
  value,
  max = 100,
  ...props
}: ProgressProps) {
  // Radix logs an error for a value outside 0 to max, and for NaN. Settle both
  // here: a number is clamped, anything else is an amount nobody knows yet.
  const known = typeof value === 'number' && Number.isFinite(value)
  const amount = known ? Math.min(Math.max(value, 0), max) : null
  const percent = amount === null ? 100 : (amount / max) * 100

  return (
    <ProgressPrimitive.Root
      data-slot='progress'
      // The fill is moved with a negative translateX, which always slides
      // left. Mirroring the whole bar in a right-to-left page makes it grow
      // from the right, the way a bar built with `width` would.
      className={cn(
        'bg-muted relative h-1.5 w-full overflow-hidden rounded-full rtl:-scale-x-100',
        className
      )}
      value={amount}
      max={max}
      {...props}
    >
      <ProgressPrimitive.Indicator
        data-slot='progress-indicator'
        className={cn(
          'bg-primary h-full w-full flex-1 rounded-full transition-transform duration-300',
          amount === null && 'animate-pulse',
          indicatorClassName
        )}
        style={{ transform: `translateX(-${100 - percent}%)` }}
      />
    </ProgressPrimitive.Root>
  )
}

export { Progress }
export type { ProgressProps }
