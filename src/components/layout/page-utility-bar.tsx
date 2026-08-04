// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: Apache-2.0

import type { HTMLAttributes } from 'react'
import { cn } from '../../lib/utils'

interface PageUtilityBarProps extends HTMLAttributes<HTMLDivElement> {
  scrollable?: boolean
  compact?: boolean
  sticky?: boolean
  contentClassName?: string
}

export function PageUtilityBar({
  children,
  className,
  contentClassName,
  scrollable = false,
  compact = false,
  sticky = true,
  ...props
}: PageUtilityBarProps) {
  return (
    <div
      className={cn(
        'bg-background/95 border-b supports-[backdrop-filter]:bg-background/90 backdrop-blur',
        sticky && 'sticky top-[calc(var(--sticky-top,0px)+56px)] z-20',
        className
      )}
      {...props}
    >
      {scrollable ? (
        <div className='overflow-x-auto no-scrollbar'>
          {/* w-full alongside min-w-max: the row fills the bar when the
              content is narrower than it, which is what gives an `ms-auto`
              child somewhere to travel to. Once the content is wider,
              min-w-max wins again and the bar scrolls as before. */}
          <div
            className={cn(
              'flex w-full min-w-max items-center gap-2 px-4',
              compact ? 'min-h-12 py-2' : 'min-h-[52px] py-2.5',
              contentClassName
            )}
          >
            {children}
          </div>
        </div>
      ) : (
        <div
          className={cn(
            'flex flex-wrap items-center gap-2 px-4',
            compact ? 'min-h-12 py-2' : 'min-h-[52px] py-2.5',
            contentClassName
          )}
        >
          {children}
        </div>
      )}
    </div>
  )
}
