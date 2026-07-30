// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: Apache-2.0

import type { CSSProperties } from 'react'
import type { LucideIcon } from 'lucide-react'
import { cn } from '../../lib/utils'

interface EmptyStateProps {
  /**
   * A Lucide component, or the URL of an SVG. Apps pass a URL to show their own
   * `images/icon.svg`, the same file the launcher and the browser tab use.
   */
  icon: LucideIcon | string
  title: string
  description?: string
  className?: string
  childrenLayout?: 'row' | 'column'
  childrenClassName?: string
  children?: React.ReactNode
}

// App icons are drawn with stroke="currentColor". An <img> resolves that
// against its own document and comes out black, so mask the shape instead and
// let the background colour supply the tint. Same approach the launcher uses.
function maskStyle(url: string): CSSProperties {
  // Quoted and encoded: an unescaped parenthesis or space makes the value
  // invalid, and a dropped mask leaves the tinted square painting on its own.
  const image = `url("${encodeURI(url)}")`
  return {
    maskImage: image,
    maskSize: 'contain',
    maskRepeat: 'no-repeat',
    maskPosition: 'center',
    WebkitMaskImage: image,
    WebkitMaskSize: 'contain',
    WebkitMaskRepeat: 'no-repeat',
    WebkitMaskPosition: 'center',
  }
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  className,
  childrenLayout = 'row',
  childrenClassName,
  children,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center p-8 text-center',
        className
      )}
    >
      <div className='mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/[0.08]'>
        {typeof Icon === 'string' ? (
          <span
            aria-hidden
            className='h-7 w-7 bg-primary/60'
            style={maskStyle(Icon)}
          />
        ) : (
          <Icon className='h-7 w-7 text-primary/60' />
        )}
      </div>
      <h3 className='text-muted-foreground mb-1 text-base font-medium'>{title}</h3>
      {description && (
        <p className='text-muted-foreground text-xs'>{description}</p>
      )}
      {children && (
        <div
          className={cn(
            'mt-4 flex justify-center gap-2',
            childrenLayout === 'column' && 'flex-col items-center gap-4',
            childrenClassName
          )}
        >
          {children}
        </div>
      )}
    </div>
  )
}
