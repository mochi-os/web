// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: Apache-2.0

import { useEffect, useState } from 'react'
import { Trans } from '@lingui/react/macro'
import {
  LogOut,
  Settings,
} from 'lucide-react'
import { cn } from '../../lib/utils'
import { onShellMessage } from '../../lib/shell-bridge'
import { useAuthStore } from '../../stores/auth-store'
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
import { Tooltip, TooltipContent, TooltipTrigger } from '../ui/tooltip'
import { EntityAvatar } from '../entity-avatar'
import { SignOutDialog } from '../sign-out-dialog'
import { NotificationsSection, type Notification } from './notification-menu'
import { t, plural } from '@lingui/core/macro'

/**
 * Notifications are supplied, never fetched: this ships in every app's bundle
 * and only the menu app holds notifications/read. Omit `notifications` and the
 * menu renders no notification affordance at all.
 */
export type MochiMenuNotifications = {
  items: Notification[]
  markAsRead: (id: string) => void
  markAllAsRead: () => void
}

type MochiMenuProps = {
  direction?: 'horizontal' | 'vertical'
  notifications?: MochiMenuNotifications
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
  version,
}: {
  unreadCount?: number
  identity?: string
  name?: string
  version?: string
}) {
  return (
    <div className='relative'>
      <EntityAvatar fingerprint={identity || undefined} version={version} name={name} size="sm" />
      {!!unreadCount && (
        <span className='absolute -right-0.5 -top-0.5 z-10 h-3 w-3 rounded-full bg-notification' />
      )}
    </div>
  )
}

export function MochiMenu({
  direction = 'horizontal',
  notifications,
  showLogo = true,
  className,
}: MochiMenuProps) {
  const [signOutOpen, setSignOutOpen] = useDialogState()
  const [menuOpen, setMenuOpen] = useState(false)
  const { isMobile } = useScreenSize()

  const name = useAuthStore((s) => s.name)
  const identity = useAuthStore((s) => s.identity)
  const avatar = useAuthStore((s) => s.avatar)
  const unreadCount =
    notifications?.items.filter((n) => n.read === 0).length ?? 0

  // The people app announces an avatar change with shellSetAvatar. Outside the
  // shell that message lands on this same window, so the menu picks up the new
  // version token and the avatar URL changes instead of answering from cache.
  useEffect(() => {
    return onShellMessage((msg) => {
      if (msg.type !== 'avatar-set') return
      if (typeof msg.version !== 'string' || msg.version.length > 64) return
      if (msg.person !== useAuthStore.getState().identity) return
      useAuthStore.getState().setAvatar(msg.version)
    })
  }, [])

  const menuContent = (
    <>
      <DropdownMenuLabel className='p-0 font-normal'>
        <div className='flex items-center justify-between px-2 py-1.5'>
          <div className='flex items-center gap-2 text-sm'>
            <EntityAvatar fingerprint={identity || undefined} version={avatar || undefined} name={name} size="md" />
            <span className='font-semibold'>{name || t`User`}</span>
          </div>
          <div className='flex items-center gap-1 ms-4'>
            <Tooltip>
              <TooltipTrigger asChild>
                <a
                  href='/settings'
                  aria-label={t`Settings`}
                  className='flex items-center justify-center rounded-md p-1.5 transition-colors hover:bg-hover active:bg-interactive-active'
                >
                  <Settings className='size-4' />
                </a>
              </TooltipTrigger>
              <TooltipContent>{t`Settings`}</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={() => setSignOutOpen(true)}
                  aria-label={t`Sign out`}
                  className='flex items-center justify-center rounded-md p-1.5 transition-colors hover:bg-hover active:bg-interactive-active'
                >
                  <LogOut className='size-4' />
                </button>
              </TooltipTrigger>
              <TooltipContent>{t`Sign out`}</TooltipContent>
            </Tooltip>
          </div>
        </div>
      </DropdownMenuLabel>

      {notifications && (
        <>
          <DropdownMenuSeparator />
          <NotificationsSection
            onClose={() => setMenuOpen(false)}
            notifications={notifications.items}
            markAsRead={notifications.markAsRead}
            markAllAsRead={notifications.markAllAsRead}
          />
        </>
      )}
    </>
  )

  const triggerLabel = unreadCount > 0
    ? plural(unreadCount, { one: 'Open menu (# unread notification)', other: 'Open menu (# unread notifications)' })
    : t`Open menu`

  const trigger = (
    <button
      aria-label={triggerLabel}
      className='rounded p-1 hover:bg-hover active:bg-interactive-active'
    >
      <UserIcon
        unreadCount={unreadCount}
        identity={identity}
        name={name}
        version={avatar || undefined}
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
            <Tooltip>
              <TooltipTrigger asChild>
                <DrawerTrigger asChild>{trigger}</DrawerTrigger>
              </TooltipTrigger>
              <TooltipContent>{triggerLabel}</TooltipContent>
            </Tooltip>
            <DrawerContent>
              <DrawerHeader>
                <DrawerTitle className='sr-only'><Trans>Menu</Trans></DrawerTitle>
              </DrawerHeader>
              <div className='px-4 pb-4'>{menuContent}</div>
            </DrawerContent>
          </Drawer>
        ) : (
          <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
            <Tooltip>
              <TooltipTrigger asChild>
                <DropdownMenuTrigger asChild>{trigger}</DropdownMenuTrigger>
              </TooltipTrigger>
              <TooltipContent>{triggerLabel}</TooltipContent>
            </Tooltip>
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
