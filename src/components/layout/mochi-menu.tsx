import { useState } from 'react'
import {
  CircleUser,
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
import { SignOutDialog } from '../sign-out-dialog'
import { NotificationsSection } from './notification-menu'

type MochiMenuProps = {
  direction?: 'horizontal' | 'vertical'
  showNotifications?: boolean
  className?: string
}

function MochiLogo() {
  return <img src='/images/logo-header.svg' alt='Mochi' className='h-6 w-6' />
}

function UserIcon({ unreadCount }: { unreadCount?: number }) {
  return (
    <div className='relative'>
      <CircleUser className='size-6 text-muted-foreground' />
      {!!unreadCount && (
        <span className='absolute -right-0.5 -top-0.5 z-10 h-3 w-3 rounded-full bg-red-500' />
      )}
    </div>
  )
}

export function MochiMenu({
  direction = 'horizontal',
  showNotifications = true,
  className,
}: MochiMenuProps) {
  const [signOutOpen, setSignOutOpen] = useDialogState()
  const [menuOpen, setMenuOpen] = useState(false)
  const { isMobile } = useScreenSize()
  const { notifications, markAsRead, markAllAsRead } = useNotifications()

  const name = useAuthStore((s) => s.name)
  const unreadCount = notifications.filter((n) => n.read === 0).length

  const menuContent = (
    <>
      <DropdownMenuLabel className='p-0 font-normal'>
        <div className='flex items-center justify-between px-2 py-1.5'>
          <div className='grid text-sm'>
            <span className='font-semibold'>{name || 'User'}</span>
          </div>
          <div className='flex items-center gap-1 ml-4'>
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

  const trigger = (
    <button className='rounded p-1 hover:bg-interactive-hover active:bg-interactive-active'>
      <UserIcon unreadCount={showNotifications ? unreadCount : 0} />
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
        <a href='/' title='Home'>
          <MochiLogo />
        </a>

        {isMobile ? (
          <Drawer open={menuOpen} onOpenChange={setMenuOpen}>
            <DrawerTrigger asChild>{trigger}</DrawerTrigger>
            <DrawerContent>
              <DrawerHeader>
                <DrawerTitle className='sr-only'>Menu</DrawerTitle>
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
