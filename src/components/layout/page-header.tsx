import { type ReactNode } from 'react'
import { BackButton, type HeaderBackConfig } from './back-button'
import { PageUtilityBar } from './page-utility-bar'
import { cn } from '../../lib/utils'

interface PageHeaderProps {
  icon?: ReactNode
  title: ReactNode
  description?: string
  actions?: ReactNode
  primaryAction?: ReactNode
  menuAction?: ReactNode
  back?: HeaderBackConfig
  /** @deprecated The sidebar trigger is rendered by the top bar — this prop is now a no-op */
  showSidebarTrigger?: boolean
}

export function PageHeader({
  icon,
  title,
  description,
  actions,
  primaryAction,
  menuAction,
  back,
}: PageHeaderProps) {
  return (
    <header
      className='bg-background sticky top-[var(--sticky-top,0px)] z-30 border-b'
      style={{ paddingRight: 'var(--removed-body-scroll-bar-size, 0px)' }}
    >
      <div className={cn('px-3 md:px-6', description ? 'py-1.5 md:py-2' : 'py-1 md:py-2')}>
        <div className='flex min-h-12 items-center gap-2 md:min-h-12 md:justify-between'>
          <div className='flex min-w-0 flex-1 items-center gap-2.5 md:gap-3'>
            {back && (
              <BackButton
                {...back}
                className={cn(back.className)}
              />
            )}
            {icon && (
              <div className='text-foreground shrink-0 [&>svg]:size-5'>
                {icon}
              </div>
            )}
            <div className='min-w-0 flex-1'>
              <h1 className='min-w-0 truncate text-[1.125rem] leading-tight font-semibold md:text-lg'>
                {title}
              </h1>
              {description && (
                <p className='text-muted-foreground mt-0.5 truncate text-sm'>
                  {description}
                </p>
              )}
            </div>
          </div>

          {(actions || primaryAction || menuAction) && (
            <div className='flex shrink-0 items-center gap-2'>
              {primaryAction && <div className='hidden md:flex'>{primaryAction}</div>}
              {actions && <div className='hidden md:flex md:items-center md:gap-2'>{actions}</div>}
              {menuAction && <div className='hidden md:flex'>{menuAction}</div>}
              {primaryAction && <div className='md:hidden'>{primaryAction}</div>}
              {menuAction && <div className='md:hidden'>{menuAction}</div>}
            </div>
          )}
        </div>
      </div>

      {actions && (
        <div className='md:hidden'>
          <PageUtilityBar compact sticky={false} className='border-b-0'>
            {actions}
          </PageUtilityBar>
        </div>
      )}
    </header>
  )
}
