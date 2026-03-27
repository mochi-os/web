import type { ReactNode } from 'react'
import { BackButton, type HeaderBackConfig } from './back-button'

interface PageHeaderProps {
  icon?: ReactNode
  title: ReactNode
  description?: string
  actions?: ReactNode
  back?: HeaderBackConfig
}

export function PageHeader({
  icon,
  title,
  description,
  actions,
  back,
}: PageHeaderProps) {
  return (
    <header
      className='bg-background sticky top-[var(--sticky-top,0px)] z-10'
      style={{ paddingRight: 'var(--removed-body-scroll-bar-size, 0px)' }}
    >
      {/* Title and actions row */}
      <div className={`flex items-start justify-between gap-3 px-4 py-2 md:items-center md:px-6 ${description ? '' : 'md:min-h-[48px]'}`}>
        <div className='min-w-0 flex-1'>
          <div className='flex items-center gap-2 md:gap-2.5'>
            {/* Back button remains opt-in and icon-only via `PageHeader.back`. */}
            {back && <BackButton {...back} />}
            {icon}
            <h1 className='truncate text-base font-semibold md:text-lg'>
              {title}
            </h1>
          </div>
          {description && (
            <p className='text-muted-foreground mt-0.5 truncate text-sm'>{description}</p>
          )}
        </div>
        {actions && <div className='flex shrink-0 items-center gap-2'>{actions}</div>}
      </div>
    </header>
  )
}
