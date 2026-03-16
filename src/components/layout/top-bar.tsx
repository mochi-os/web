import { useEffect } from 'react'
import { LogIn, PanelLeft } from 'lucide-react'

import { cn } from '../../lib/utils'
import { isDomainEntityRouting } from '../../lib/app-path'
import { useAuthStore } from '../../stores/auth-store'
import { useTheme } from '../../context/theme-provider'
import { useScreenSize } from '../../hooks/use-screen-size'
import { useSidebar } from '../ui/sidebar'
import { Button } from '../ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '../ui/dropdown-menu'
import { MochiMenu } from './mochi-menu'

type TopBarProps = {
  showNotifications?: boolean
  showSidebarTrigger?: boolean
  vertical?: boolean
  className?: string
}

function MochiLogo() {
  return (
    <div className='pt-2'>
      <img src='/images/logo-header.svg' alt='Mochi' className='h-6 w-6' />
    </div>
  )
}

export function TopBar({
  showNotifications = true,
  showSidebarTrigger = false,
  vertical = false,
  className,
}: TopBarProps) {
  const { theme } = useTheme()
  const { isMobile } = useScreenSize()
  const { toggleSidebar } = useSidebar()
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)

  useEffect(() => {
    const meta = document.querySelector("meta[name='theme-color']")
    meta?.setAttribute('content', theme === 'dark' ? '#020817' : '#fff')
  }, [theme])

  if (!isAuthenticated) {
    const isDomainRouted = isDomainEntityRouting()

    return (
      <header className={cn('z-50 flex h-12 items-center px-4', className)}>
        {isDomainRouted ? (
          <MochiLogo />
        ) : (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant='ghost' className='gap-2'>
                <MochiLogo />
                <span className='font-semibold'>Mochi</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align='start'>
              <DropdownMenuItem asChild>
                <a href='/login'>
                  <LogIn className='size-4' />
                  Log in
                </a>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </header>
    )
  }

  return (
    <header
      className={cn(
        'z-50 flex items-center gap-2 px-2 py-4 overflow-visible',
        vertical && 'flex-col',
        className
      )}
    >
      {showSidebarTrigger && isMobile && (
        <button
          onClick={toggleSidebar}
          className='rounded p-1 hover:bg-interactive-hover active:bg-interactive-active'
        >
          <PanelLeft className='size-5 text-muted-foreground' />
        </button>
      )}

      <MochiMenu
        direction={vertical ? 'vertical' : 'horizontal'}
        showNotifications={showNotifications}
      />

      {!vertical && <div className='flex-1' />}
    </header>
  )
}
