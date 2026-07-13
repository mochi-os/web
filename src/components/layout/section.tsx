// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: Apache-2.0

import * as React from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card'
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
  const hasContent = children !== undefined && children !== null && children !== false && !(Array.isArray(children) && children.length === 0)
  const isContentHidden = contentClassName?.includes('hidden')
  const showContent = hasContent && !isContentHidden

  return (
    <Card className={cn('shadow-md', className)}>
      <CardHeader className={cn('flex flex-row items-start justify-between space-y-0', showContent ? 'border-b/60 border-b pb-2' : 'pb-2')}>
        <div className="space-y-1">
          <CardTitle className="text-lg leading-tight">{title}</CardTitle>
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
}

export function FieldRow({ label, children, className, description }: FieldRowProps) {
  return (
    <div className={cn('grid grid-cols-1 items-start gap-2 py-2 sm:grid-cols-[300px_minmax(0,1fr)] sm:gap-5', className)}>
      <div className="flex min-h-9 flex-col justify-center">
        <dt className='text-muted-foreground text-sm font-medium leading-none sm:leading-tight'>
          {label}
        </dt>
        {description && (
          <p className='text-muted-foreground/70 mt-1 text-xs leading-normal'>
            {description}
          </p>
        )}
      </div>
      <dd className='flex min-h-9 min-w-0 items-center gap-2'>
        {children}
      </dd>
    </div>
  )
}
