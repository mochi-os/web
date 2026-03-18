import { useEffect } from 'react'
import { PanelLeft } from 'lucide-react'

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
    return null
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
        <Button
          type='button'
          variant='ghost'
          size='icon'
          onClick={toggleSidebar}
          aria-label='Toggle sidebar'
        >
          <PanelLeft className='size-5 text-muted-foreground' />
        </Button>
      )}

      <MochiMenu
        direction={vertical ? 'vertical' : 'horizontal'}
        showNotifications={showNotifications}
      />

      {!vertical && <div className='flex-1' />}
    </header>
  )
}
