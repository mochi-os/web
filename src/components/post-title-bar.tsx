import type { ReactNode } from 'react'
import { cn } from '../lib/utils'

type PostTitleBarSize = 'card' | 'detail'

interface PostTitleBarProps {
  title: ReactNode
  meta?: ReactNode
  trailing?: ReactNode
  size?: PostTitleBarSize
  className?: string
  titleClassName?: string
  metaClassName?: string
  trailingClassName?: string
}

export function PostTitleBar({
  title,
  meta,
  trailing,
  size = 'detail',
  className,
  titleClassName,
  metaClassName,
  trailingClassName,
}: PostTitleBarProps) {
  return (
    <div
      className={cn(
        '-mx-4 -mt-4 mb-3 rounded-t-[10px] bg-primary px-4 py-2.5',
        className
      )}
    >
      <div className='flex flex-col gap-2 md:flex-row md:items-start md:justify-between'>
        <div className='min-w-0 flex-1'>
          <div
            className={cn(
              size === 'card'
                ? 'text-[clamp(1rem,0.96rem+0.55vw,1.125rem)] leading-[1.2] md:text-lg md:leading-tight'
                : 'text-[clamp(1.0625rem,1rem+0.8vw,1.25rem)] leading-[1.15] md:text-lg md:leading-tight',
              'text-primary-foreground font-semibold break-words text-balance',
              titleClassName
            )}
          >
            {title}
          </div>
        </div>
        {(trailing || meta) && (
          <div className='flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 md:ms-4 md:max-w-[50%] md:justify-end'>
            {trailing && (
              <div
                className={cn(
                  'flex min-w-0 flex-wrap items-center gap-2',
                  trailingClassName
                )}
              >
                {trailing}
              </div>
            )}
            {meta && (
              <div
                className={cn(
                  'text-primary-foreground/70 min-w-0 break-words text-[11px] leading-4 md:text-end md:text-xs',
                  metaClassName
                )}
              >
                {meta}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
