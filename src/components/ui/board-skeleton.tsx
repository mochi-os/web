// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: Apache-2.0

import { Skeleton } from './skeleton'
import { Card, CardContent } from './card'
import { cn } from '../../lib/utils'

interface BoardSkeletonProps {
  columnCount?: number
  cardCountPerColumn?: number
  className?: string
}

export function BoardSkeleton({
  columnCount = 4,
  cardCountPerColumn = 3,
  className,
}: BoardSkeletonProps) {
  return (
    <div className={cn('flex gap-4 overflow-x-auto pb-4', className)}>
      {Array.from({ length: columnCount }).map((_, i) => (
        <div key={i} className='min-w-[300px] flex-1 space-y-4 rounded-lg bg-muted/30 p-3'>
          {/* Column Header */}
          <div className='flex items-center justify-between px-1 mb-2'>
            <div className='flex items-center gap-2'>
              <Skeleton className='h-3 w-3 rounded-full' />
              <Skeleton className='h-4 w-24' />
            </div>
            <Skeleton className='h-4 w-4 rounded-sm' />
          </div>

          {/* Column Cards */}
          <div className='space-y-3'>
            {Array.from({ length: cardCountPerColumn }).map((_, j) => (
              <Card key={j} className='shadow-sm border-transparent'>
                <CardContent className='p-3 space-y-3'>
                  <Skeleton className='h-4 w-full' />
                  <div className='space-y-1.5'>
                    <Skeleton className='h-2 w-3/4' />
                    <Skeleton className='h-2 w-1/2' />
                  </div>
                  <div className='flex items-center justify-between pt-1'>
                    <div className='flex gap-1'>
                      <Skeleton className='h-5 w-10 rounded-sm' />
                      <Skeleton className='h-5 w-10 rounded-sm' />
                    </div>
                    <Skeleton className='h-6 w-6 rounded-full' />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Add Item Trigger */}
          <Skeleton className='h-10 w-full rounded-md' />
        </div>
      ))}
    </div>
  )
}
