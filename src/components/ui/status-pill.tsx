// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: Apache-2.0

import type * as React from 'react'
import { Badge } from './badge'
import { cn } from '../../lib/utils'

export type StatusTone =
  | 'success'
  | 'warning'
  | 'caution'
  | 'danger'
  | 'info'
  | 'accent'
  | 'neutral'

const toneClasses: Record<StatusTone, string> = {
  success: 'bg-success/15 text-success dark:bg-success/20',
  warning:
    'bg-warning/25 text-warning-foreground dark:bg-warning/15 dark:text-warning',
  // No theme token maps to orange, so this tone stays on the raw palette.
  caution: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400',
  danger: 'bg-destructive/10 text-destructive dark:bg-destructive/15',
  info: 'bg-info/15 text-info dark:bg-info/20',
  accent: 'bg-primary/10 text-primary dark:bg-primary/20',
  neutral: 'bg-muted text-muted-foreground',
}

/** Resolves a tone to its class string, falling back to `neutral`. */
export function statusToneClass(tone: StatusTone): string {
  return toneClasses[tone] ?? toneClasses.neutral
}

export function humanizeStatus(status: string): string {
  return status.replace(/_/g, ' ').replace(/^\w/, (c) => c.toUpperCase())
}

interface StatusPillProps extends React.ComponentProps<typeof Badge> {
  /** Omit to render an untinted pill, for statuses with no tone assigned. */
  tone?: StatusTone
}

export function StatusPill({
  tone,
  className,
  children,
  ...props
}: StatusPillProps) {
  return (
    <Badge
      variant='outline'
      className={cn(tone && statusToneClass(tone), className)}
      {...props}
    >
      {children}
    </Badge>
  )
}
