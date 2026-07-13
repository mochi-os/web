// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: Apache-2.0

import { cn } from '../lib/utils'
import { Label } from './ui/label'

interface PreferenceItemProps {
  label: string
  description: string
  children: React.ReactNode
  className?: string
}

export function PreferenceItem({
  label,
  description,
  children,
  className,
}: PreferenceItemProps) {
  return (
    <div
      className={cn(
        'flex flex-col gap-4 py-5 sm:flex-row sm:items-center sm:justify-between first:pt-0 last:pb-0',
        className
      )}
    >
      <div className='space-y-1 flex-1'>
        <Label className='text-sm font-medium'>{label}</Label>
        <p className='text-muted-foreground text-xs leading-relaxed'>
          {description}
        </p>
      </div>
      <div className='w-full sm:w-64'>{children}</div>
    </div>
  )
}
