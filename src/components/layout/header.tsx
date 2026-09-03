// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: Apache-2.0

import { cn } from '../../lib/utils'

type HeaderProps = React.HTMLAttributes<HTMLElement> & {
  compact?: boolean
}

export function Header({ className, compact, children, ...props }: HeaderProps) {
  // Don't render empty header
  if (!children) {
    return null
  }

  return (
    <header
      className={cn('z-40', compact ? 'h-14' : 'h-17', 'border-b bg-background', className)}
      {...props}
    >
      <div className='relative flex h-full w-full items-center justify-center'>
        <div
          className={cn(
            'flex h-full w-full items-center gap-3 sm:gap-4',
            '@7xl/content:mx-auto @7xl/content:max-w-7xl',
            compact ? 'px-4 py-2' : 'p-4'
          )}
        >
          {children}
        </div>
      </div>
    </header>
  )
}
