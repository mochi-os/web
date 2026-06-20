// Copyright © 2026 Mochi OÜ
// SPDX-License-Identifier: Apache-2.0

import { Skeleton } from './skeleton'
import { cn } from '../../lib/utils'

interface DetailSkeletonProps {
  className?: string
}

export function DetailSkeleton({ className }: DetailSkeletonProps) {
  return (
    <div className={cn('space-y-6 p-6', className)}>
      {/* Header section */}
      <div className='flex items-start justify-between gap-4'>
        <div className='flex-1 space-y-2'>
          <Skeleton className='h-8 w-2/3' />
          <Skeleton className='h-4 w-1/3' />
        </div>
        <Skeleton className='h-10 w-24' />
      </div>

      {/* Main content sections */}
      <div className='space-y-4'>
        <div className='space-y-2'>
          <Skeleton className='h-4 w-20' />
          <Skeleton className='h-24 w-full' />
        </div>

        {/* Info grid */}
        <div className='grid grid-cols-2 gap-4 pt-4'>
          <div className='space-y-2'>
            <Skeleton className='h-3 w-16' />
            <Skeleton className='h-5 w-24' />
          </div>
          <div className='space-y-2'>
            <Skeleton className='h-3 w-16' />
            <Skeleton className='h-5 w-24' />
          </div>
          <div className='space-y-2'>
            <Skeleton className='h-3 w-16' />
            <Skeleton className='h-5 w-24' />
          </div>
          <div className='space-y-2'>
            <Skeleton className='h-3 w-16' />
            <Skeleton className='h-5 w-24' />
          </div>
        </div>
      </div>

      {/* Action items/list section */}
      <div className='space-y-3 pt-6'>
        <Skeleton className='h-4 w-32' />
        <div className='space-y-2'>
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className='flex items-center gap-3'>
              <Skeleton className='h-8 w-8 rounded-full' />
              <Skeleton className='h-4 flex-1' />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
