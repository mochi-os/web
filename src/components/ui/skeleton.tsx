// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: Apache-2.0

import { cn } from '../../lib/utils'

function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      data-slot='skeleton'
      className={cn('bg-hover animate-pulse rounded-md', className)}
      {...props}
    />
  )
}

export { Skeleton }
