// Copyright © 2026 Mochi OÜ
// SPDX-License-Identifier: Apache-2.0

import { useEffect } from 'react'
import { PanelLeftClose, PanelLeftOpen } from 'lucide-react'

import { cn } from '../../lib/utils'
import { useAuthStore } from '../../stores/auth-store'
import { useTheme } from '../../context/theme-provider'
import { useScreenSize } from '../../hooks/use-screen-size'
import { useSidebar } from '../ui/sidebar'
import { Button } from '../ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '../ui/tooltip'
import { MochiMenu } from './mochi-menu'
import { t } from '@lingui/core/macro'

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
  const { resolvedTheme } = useTheme()
  const { isMobile, isTablet } = useScreenSize()
  const { toggleSidebar, open: sidebarOpen } = useSidebar()
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)

  useEffect(() => {
    const meta = document.querySelector("meta[name='theme-color']")
    meta?.setAttribute('content', resolvedTheme === 'dark' ? '#1a1a1a' : '#fff')
  }, [resolvedTheme])

  if (!isAuthenticated) {
    return null
  }

  // Mobile with sidebar: [navigation] [Logo] ··spacer·· [User]
  if (showSidebarTrigger && (isMobile || isTablet)) {
    return (
      <header
        className={cn(
          'z-50 flex items-center gap-2 px-2 overflow-visible',
          className
        )}
      >
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              type='button'
              variant='ghost'
              size='icon'
              className='shrink-0'
              onClick={toggleSidebar}
              aria-label={t`Open navigation`}
            >
              {sidebarOpen ? <PanelLeftClose className='size-5' /> : <PanelLeftOpen className='size-5' />}
            </Button>
          </TooltipTrigger>
          <TooltipContent>{t`Open navigation`}</TooltipContent>
        </Tooltip>

        <a href='/' title={t`Home`}>
          <img
            src='/images/logo-header.png'
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
            title={t`Home`}
            className='flex size-10 items-center justify-center rounded-md transition-colors duration-150 hover:bg-hover active:bg-interactive-active'
          >
            <img
              src='/images/logo-header.png'
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

  // Desktop / no-sidebar layout. The `py-4` belongs to the vertical desktop
  // strip; applying it to the horizontal mobile variant pushes the header
  // taller than the wrapping `h-12` container and overflows into the page.
  return (
    <header
      className={cn(
        'z-50 flex items-center gap-2 px-2 overflow-visible',
        vertical ? 'flex-col py-4' : 'w-full',
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
