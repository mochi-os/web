// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: Apache-2.0

import * as React from 'react'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '../ui/card'
import { cn } from '../../lib/utils'

interface SectionProps {
  title: string
  description?: string
  children?: React.ReactNode
  className?: string
  contentClassName?: string
  action?: React.ReactNode
}

export function Section({
  title,
  description,
  children,
  className,
  contentClassName,
  action,
}: SectionProps) {
  const hasContent =
    children !== undefined &&
    children !== null &&
    children !== false &&
    !(Array.isArray(children) && children.length === 0)
  const isContentHidden = contentClassName?.includes('hidden')
  const showContent = hasContent && !isContentHidden

  return (
    <Card className={cn('shadow-md', className)}>
      <CardHeader
        className={cn(
          'flex flex-row items-start justify-between gap-3 space-y-0',
          showContent ? 'border-b/60 border-b pb-2' : 'pb-2'
        )}
      >
        <div className='min-w-0 space-y-1'>
          <CardTitle className='text-lg leading-tight'>{title}</CardTitle>
          {description && <CardDescription>{description}</CardDescription>}
        </div>
        {action}
      </CardHeader>
      {showContent && (
        <CardContent className={cn('py-1', contentClassName)}>
          {children}
        </CardContent>
      )}
    </Card>
  )
}

interface FieldRowProps {
  label: string
  children: React.ReactNode
  className?: string
  description?: string
  /**
   * For a row whose control is a switch or another small control. Below sm
   * the control sits at the end of the label's line instead of under it, the
   * way a phone's own settings lay a toggle out. From sm up nothing changes.
   */
  inline?: boolean
}

export function FieldRow({
  label,
  children,
  className,
  description,
  inline = false,
}: FieldRowProps) {
  return (
    <dl
      className={cn(
        'm-0 grid gap-2 py-2 sm:grid-cols-[300px_minmax(0,1fr)] sm:items-start sm:gap-5',
        inline
          ? 'grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4'
          : 'grid-cols-1 items-start',
        className
      )}
    >
      <dt className='flex min-h-9 flex-col justify-center'>
        <span
          className={cn(
            'text-muted-foreground text-sm font-medium sm:leading-tight',
            // An inline label shares its line, so it wraps sooner and needs
            // room between its lines.
            inline ? 'leading-snug' : 'leading-none'
          )}
        >
          {label}
        </span>
        {description && (
          <span className='text-muted-foreground/70 mt-1 text-xs leading-normal'>
            {description}
          </span>
        )}
      </dt>
      <dd className='m-0 flex min-h-9 min-w-0 items-center gap-2'>
        {children}
      </dd>
    </dl>
  )
}
