import type { ReactNode } from 'react'
import { cn } from '../../lib/utils'

interface GameHeaderStatProps {
  icon?: ReactNode
  label?: ReactNode
  value?: ReactNode
  srLabel?: string
  className?: string
  labelClassName?: string
  valueClassName?: string
}

export function GameHeaderStat({
  icon,
  label,
  value,
  srLabel,
  className,
  labelClassName,
  valueClassName,
}: GameHeaderStatProps) {
  return (
    <span className={cn('flex items-center gap-1.5 tabular-nums', className)}>
      {icon}
      {srLabel ? <span className='sr-only'>{srLabel}</span> : null}
      {label != null ? (
        <span className={cn('max-w-[7.5rem] truncate text-sm font-medium', labelClassName)}>
          {label}
        </span>
      ) : null}
      {value != null ? (
        <span className={cn('text-sm font-semibold', valueClassName)}>{value}</span>
      ) : null}
    </span>
  )
}

interface GameHeaderStoneDotProps {
  color: 'black' | 'white'
  className?: string
}

export function GameHeaderStoneDot({ color, className }: GameHeaderStoneDotProps) {
  return (
    <span
      aria-hidden='true'
      className={cn(
        'inline-block size-3 shrink-0 rounded-full',
        color === 'black'
          ? 'border border-gray-700 bg-gray-900 dark:border-gray-600 dark:bg-gray-800'
          : 'border border-gray-400 bg-gray-100 dark:border-gray-500 dark:bg-gray-200',
        className
      )}
    />
  )
}
