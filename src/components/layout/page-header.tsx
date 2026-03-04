import type { ReactNode } from 'react'
import { useScreenSize } from '../../hooks/use-screen-size'
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
  const { isMobile } = useScreenSize()

  return (
    <header className='bg-background sticky top-0 z-10'>
      {/* Title and actions row */}
      <div className={`flex items-start justify-between gap-3 px-4 py-2 md:items-center md:px-6 ${description ? '' : 'md:min-h-[48px]'}`}>
        <div className='min-w-0 flex-1'>
          <div className='flex items-center gap-2 md:gap-2.5'>
            {/* Back button remains opt-in and icon-only via `PageHeader.back`. */}
            {back && <BackButton {...back} />}
            {icon}
            <h1
              className={`truncate ${
                isMobile ? 'text-base font-semibold' : 'text-lg font-semibold'
              }`}
            >
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
