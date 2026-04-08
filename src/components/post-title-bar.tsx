import type { ReactNode } from 'react'
import { cn } from '../lib/utils'

interface PostTitleBarProps {
  title: ReactNode
  meta?: ReactNode
  trailing?: ReactNode
  className?: string
  titleClassName?: string
  metaClassName?: string
  trailingClassName?: string
}

export function PostTitleBar({
  title,
  meta,
  trailing,
  className,
  titleClassName,
  metaClassName,
  trailingClassName,
}: PostTitleBarProps) {
  return (
    <div
      className={cn(
        '-mx-4 -mt-4 mb-3 rounded-t-[10px] bg-selected px-4 py-2.5',
        className
      )}
    >
      <div className='flex flex-col gap-2 md:flex-row md:items-start md:justify-between'>
        <div className='min-w-0 flex-1'>
          <div
            className={cn(
              'text-lg leading-tight font-semibold break-words text-balance',
              titleClassName
            )}
          >
            {title}
          </div>
        </div>
        {(trailing || meta) && (
          <div className='flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 md:ml-4 md:max-w-[50%] md:justify-end'>
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
                  'text-muted-foreground min-w-0 break-words text-xs md:text-right',
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
