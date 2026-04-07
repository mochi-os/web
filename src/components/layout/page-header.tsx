import type { ReactNode } from 'react'
import { BackButton, type HeaderBackConfig } from './back-button'

interface PageHeaderProps {
  icon?: ReactNode
  title: ReactNode
  description?: string
  actions?: ReactNode
  menuAction?: ReactNode
  back?: HeaderBackConfig
}

export function PageHeader({
  icon,
  title,
  description,
  actions,
  menuAction,
  back,
}: PageHeaderProps) {
  return (
    <header
      className='bg-background sticky md:top-[var(--sticky-top,0px)] z-10'
      style={{ paddingRight: 'var(--removed-body-scroll-bar-size, 0px)' }}
    >
      <div className={`px-4 py-2 md:px-6 ${description ? '' : 'md:min-h-[48px]'}`}>
        <div className='flex items-start gap-3 md:items-center md:justify-between'>
          <div className='min-w-0 flex-1'>
            <div className='flex items-start gap-2 md:items-center md:gap-2.5'>
              {/* Back button remains opt-in and icon-only via `PageHeader.back`. */}
              {back && <BackButton {...back} />}
              {icon && <div className='shrink-0 pt-0.5 md:pt-0'>{icon}</div>}
              <h1 className='min-w-0 flex-1 line-clamp-2 text-base leading-tight font-semibold md:line-clamp-1 md:text-lg md:leading-tight'>
                {title}
              </h1>
              {menuAction && (
                <div className='ml-auto shrink-0 md:hidden'>{menuAction}</div>
              )}
            </div>
            {description && (
              <p className='text-muted-foreground mt-0.5 truncate text-sm'>{description}</p>
            )}
          </div>
          {(actions || menuAction) && (
            <div className='hidden shrink-0 items-center gap-2 md:flex'>
              {actions}
              {menuAction}
            </div>
          )}
        </div>
        {actions && (
          <div className='mt-2 flex flex-wrap items-center gap-2 md:hidden'>
            {actions}
          </div>
        )}
      </div>
    </header>
  )
}
