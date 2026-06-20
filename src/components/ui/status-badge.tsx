// Copyright © 2026 Mochi OÜ
// SPDX-License-Identifier: Apache-2.0

import type { LucideIcon } from 'lucide-react'
import { cn } from '../../lib/utils'

type StatusVariant = 'success' | 'info' | 'warning' | 'muted'

const variantStyles: Record<StatusVariant, string> = {
  success: 'bg-success/10',
  info: 'bg-info/10',
  warning: 'bg-warning/15 dark:bg-warning/10',
  muted: 'bg-muted/30',
}

const iconContainerStyles: Record<StatusVariant, string> = {
  success: 'bg-success/15 dark:bg-success/25',
  info: 'bg-info/15 dark:bg-info/25',
  warning: 'bg-warning/30 dark:bg-warning/20',
  muted: 'bg-muted',
}

const iconStyles: Record<StatusVariant, string> = {
  success: 'text-success',
  info: 'text-info',
  warning: 'text-warning-foreground dark:text-warning',
  muted: 'text-muted-foreground',
}

interface StatusBadgeProps {
  icon: LucideIcon
  title: string
  description?: string
  variant?: StatusVariant
  bordered?: boolean
  className?: string
}

export function StatusBadge({
  icon: Icon,
  title,
  description,
  variant = 'muted',
  bordered = true,
  className,
}: StatusBadgeProps) {
  return (
    <div
      className={cn(
        'flex items-center gap-3 rounded-lg px-4 py-3',
        bordered && 'border',
        variantStyles[variant],
        className
      )}
    >
      <div
        className={cn(
          'flex h-10 w-10 items-center justify-center rounded-full',
          iconContainerStyles[variant]
        )}
      >
        <Icon className={cn('h-5 w-5', iconStyles[variant])} />
      </div>
      <div className='flex-1'>
        <p className='text-sm font-medium text-foreground'>{title}</p>
        {description && (
          <p className='text-muted-foreground text-xs'>{description}</p>
        )}
      </div>
    </div>
  )
}
