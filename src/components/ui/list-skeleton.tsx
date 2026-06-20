// Copyright © 2026 Mochi OÜ
// SPDX-License-Identifier: Apache-2.0

import { Skeleton } from './skeleton'
import { Card, CardContent } from './card'
import { cn } from '../../lib/utils'

export interface ListSkeletonProps {
  count?: number
  className?: string
  /**
   * The height of each item in 'simple' mode.
   * @default "h-16"
   */
  height?: string
  /**
   * Whether to show an avatar skeleton in 'simple' mode.
   * @default false
   */
  avatar?: boolean
  /**
   * The visual variant of the skeleton.
   * 'card': Renders a stack of Cards (legacy behavior).
   * 'simple': Renders a stack of divs.
   * @default "card"
   */
  variant?: 'card' | 'simple'
}

export function ListSkeleton({
  count = 3,
  className,
  height = 'h-16',
  avatar = false,
  variant = 'card',
}: ListSkeletonProps) {
  if (variant === 'simple') {
    return (
      <div className={cn('flex flex-col gap-2', className)}>
        {Array.from({ length: count }).map((_, i) => (
          <div
            key={i}
            className={`flex items-center gap-4 ${height} w-full px-2`}
          >
            {avatar && <Skeleton className='size-10 shrink-0 rounded-full' />}
            <div className='flex flex-1 flex-col gap-2'>
              <Skeleton className='h-4 w-3/4' />
              <Skeleton className='h-3 w-1/2' />
            </div>
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className={cn('space-y-4', className)}>
      {Array.from({ length: count }).map((_, i) => (
        <Card key={i} className='overflow-hidden shadow-none'>
          <CardContent className='p-4'>
            <div className='flex items-center gap-4'>
              <Skeleton className='h-10 w-10 shrink-0 rounded-full' />
              <div className='flex-1 space-y-2'>
                <Skeleton className='h-4 w-1/4' />
                <Skeleton className='h-3 w-3/4' />
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
