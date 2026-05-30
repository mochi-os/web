import { useState } from 'react'
import { Trans } from '@lingui/react/macro'
import {
  LogOut,
  Settings,
} from 'lucide-react'
import { cn } from '../../lib/utils'
import { useAuthStore } from '../../stores/auth-store'
import { useNotifications } from '../../hooks/use-notifications'
import useDialogState from '../../hooks/use-dialog-state'
import { useScreenSize } from '../../hooks/use-screen-size'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../ui/dropdown-menu'
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from '../ui/drawer'
import { EntityAvatar } from '../entity-avatar'
import { SignOutDialog } from '../sign-out-dialog'
import { NotificationsSection } from './notification-menu'
import { t } from '@lingui/core/macro'

type MochiMenuProps = {
  direction?: 'horizontal' | 'vertical'
  showNotifications?: boolean
  showLogo?: boolean
  className?: string
}

function MochiLogo() {
  return <img src='/images/logo-header.png' alt='Mochi' className='h-6 w-6' />
}

function UserIcon({
  unreadCount,
  identity,
  name,
}: {
  unreadCount?: number
  identity?: string
  name?: string
}) {
  return (
    <div className='relative'>
      <EntityAvatar fingerprint={identity || undefined} name={name} size="sm" />
      {!!unreadCount && (
        <span className='absolute -right-0.5 -top-0.5 z-10 h-3 w-3 rounded-full bg-notification' />
      )}
    </div>
  )
}

export function MochiMenu({
  direction = 'horizontal',
  showNotifications = true,
  showLogo = true,
  className,
}: MochiMenuProps) {
  const [signOutOpen, setSignOutOpen] = useDialogState()
  const [menuOpen, setMenuOpen] = useState(false)
  const { isMobile } = useScreenSize()
  const { notifications, markAsRead, markAllAsRead } = useNotifications()

  const name = useAuthStore((s) => s.name)
  const identity = useAuthStore((s) => s.identity)
  const unreadCount = notifications.filter((n) => n.read === 0).length

  const menuContent = (
    <>
      <DropdownMenuLabel className='p-0 font-normal'>
        <div className='flex items-center justify-between px-2 py-1.5'>
          <div className='flex items-center gap-2 text-sm'>
            <EntityAvatar fingerprint={identity || undefined} name={name} size="md" />
            <span className='font-semibold'>{name || 'User'}</span>
          </div>
          <div className='flex items-center gap-1 ms-4'>
            <a
              href='/settings'
              className='flex items-center justify-center rounded-md p-1.5 transition-colors hover:bg-interactive-hover active:bg-interactive-active'
            >
              <Settings className='size-4' />
            </a>
            <button
              onClick={() => setSignOutOpen(true)}
              className='flex items-center justify-center rounded-md p-1.5 transition-colors hover:bg-interactive-hover active:bg-interactive-active'
            >
              <LogOut className='size-4' />
            </button>
          </div>
        </div>
      </DropdownMenuLabel>

      {showNotifications && (
        <>
          <DropdownMenuSeparator />
          <NotificationsSection
            onClose={() => setMenuOpen(false)}
            notifications={notifications}
            markAsRead={markAsRead}
            markAllAsRead={markAllAsRead}
          />
        </>
      )}
    </>
  )

  const triggerLabel = unreadCount > 0
    ? `Open menu (${unreadCount} unread notification${unreadCount === 1 ? '' : 's'})`
    : 'Open menu'

  const trigger = (
    <button
      aria-label={triggerLabel}
      className='rounded p-1 hover:bg-interactive-hover active:bg-interactive-active'
    >
      <UserIcon
        unreadCount={showNotifications ? unreadCount : 0}
        identity={identity}
        name={name}
      />
    </button>
  )

  return (
    <>
      <div
        className={cn(
          'flex items-center gap-2 overflow-visible',
          direction === 'vertical' && 'flex-col',
          className
        )}
      >
        {showLogo && (
          <a href='/' title={t`Home`}>
            <MochiLogo />
          </a>
        )}

        {isMobile ? (
          <Drawer open={menuOpen} onOpenChange={setMenuOpen} direction="bottom">
            <DrawerTrigger asChild>{trigger}</DrawerTrigger>
            <DrawerContent>
              <DrawerHeader>
                <DrawerTitle className='sr-only'><Trans>Menu</Trans></DrawerTitle>
              </DrawerHeader>
              <div className='px-4 pb-4'>{menuContent}</div>
            </DrawerContent>
          </Drawer>
        ) : (
          <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
            <DropdownMenuTrigger asChild>{trigger}</DropdownMenuTrigger>
            <DropdownMenuContent align='start' className='min-w-72'>
              {menuContent}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>

      <SignOutDialog open={!!signOutOpen} onOpenChange={setSignOutOpen} />
    </>
  )
}
