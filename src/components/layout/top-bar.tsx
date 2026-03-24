import { useEffect } from 'react'
import { Menu } from 'lucide-react'

import { cn } from '../../lib/utils'
import { useAuthStore } from '../../stores/auth-store'
import { useTheme } from '../../context/theme-provider'
import { useScreenSize } from '../../hooks/use-screen-size'
import { useSidebar } from '../ui/sidebar'
import { Button } from '../ui/button'
import { MochiMenu } from './mochi-menu'

type TopBarProps = {
  showNotifications?: boolean
  showSidebarTrigger?: boolean
  vertical?: boolean
  className?: string
  mobileTitle?: React.ReactNode
}

export function TopBar({
  showNotifications = true,
  showSidebarTrigger = false,
  vertical = false,
  className,
  mobileTitle,
}: TopBarProps) {
  const { theme } = useTheme()
  const { isMobile, isTablet } = useScreenSize()
  const { toggleSidebar } = useSidebar()
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)

  useEffect(() => {
    const meta = document.querySelector("meta[name='theme-color']")
    meta?.setAttribute('content', theme === 'dark' ? '#020817' : '#fff')
  }, [theme])

  if (!isAuthenticated) {
    return null
  }

  // Mobile with sidebar: [☰] [Logo] ··spacer·· [User]
  if (showSidebarTrigger && (isMobile || isTablet)) {
    return (
      <header
        className={cn(
          'z-50 flex items-center gap-2 px-2 overflow-visible',
          className
        )}
      >
        <Button
          type='button'
          variant='ghost'
          size='icon'
          className='shrink-0'
          onClick={toggleSidebar}
          aria-label='Open navigation'
        >
          <Menu className='size-5' />
        </Button>

        <a href='/' title='Home'>
          <img
            src='/images/logo-header.svg'
            alt='Mochi'
            className='h-6 w-6'
          />
        </a>

        <div className='flex-1' />

        <MochiMenu
          showNotifications={showNotifications}
          showLogo={false}
        />
      </header>
    )
  }

  if (isMobile && mobileTitle) {
    return (
      <header
        className={cn(
          'z-50 w-full overflow-visible',
          className
        )}
      >
        <div className='grid grid-cols-[2.75rem_minmax(0,1fr)_2.75rem] items-center gap-1'>
          <a
            href='/'
            title='Home'
            className='flex size-10 items-center justify-center rounded-md transition-colors duration-150 hover:bg-interactive-hover active:bg-interactive-active'
          >
            <img
              src='/images/logo-header.svg'
              alt='Mochi'
              className='h-6 w-6'
            />
          </a>

          <div className='min-w-0 overflow-hidden text-center whitespace-nowrap text-ellipsis'>
            {mobileTitle}
          </div>

          <div className='flex justify-center'>
            <MochiMenu
              showNotifications={showNotifications}
              showLogo={false}
            />
          </div>
        </div>
      </header>
    )
  }

  // Desktop / no-sidebar layout
  return (
    <header
      className={cn(
        'z-50 flex items-center gap-2 px-2 py-4 overflow-visible',
        vertical && 'flex-col',
        className
      )}
    >
      <MochiMenu
        direction={vertical ? 'vertical' : 'horizontal'}
        showNotifications={showNotifications}
      />

      {!vertical && <div className='flex-1' />}
    </header>
  )
}
