import type { LucideIcon } from 'lucide-react'
import { cn } from '../../lib/utils'

interface EmptyStateProps {
  icon: LucideIcon
  title: string
  description?: string
  className?: string
  childrenLayout?: 'row' | 'column'
  childrenClassName?: string
  children?: React.ReactNode
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
        <Icon className='h-7 w-7 text-primary/60' />
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
