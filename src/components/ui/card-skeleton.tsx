// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: Apache-2.0

import { Skeleton } from './skeleton'
import { Card, CardContent } from './card'
import { cn } from '../../lib/utils'

interface CardSkeletonProps {
  count?: number
  className?: string
}

export function CardSkeleton({ count = 3, className }: CardSkeletonProps) {
  return (
    <div
      className={cn(
        'grid gap-4 sm:grid-cols-2 lg:grid-cols-3',
        className
      )}
    >
      {Array.from({ length: count }).map((_, i) => (
        <Card key={i} className='overflow-hidden shadow-none'>
          <CardContent className='p-4'>
            <div className='space-y-3'>
              <Skeleton className='h-5 w-3/4' />
              <div className='space-y-1.5'>
                <Skeleton className='h-3 w-full' />
                <Skeleton className='h-3 w-5/6' />
              </div>
              <div className='flex gap-2 pt-2'>
                <Skeleton className='h-7 w-16 rounded-full' />
                <Skeleton className='h-7 w-16 rounded-full' />
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
