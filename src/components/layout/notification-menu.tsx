// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: Apache-2.0

import { Bell, Check, ExternalLink } from 'lucide-react'
import { cn } from '../../lib/utils'
import { shellNavigateExternal } from '../../lib/shell-bridge'
import { getSafeNavigationTarget } from '../../lib/safe-navigation'
import { toast } from '../../lib/toast-utils'
import { useFormat } from '../../hooks/use-format'
import { ScrollArea } from '../ui/scroll-area'
import { ListSkeleton } from '../ui/list-skeleton'
import { NotificationSourceIcon } from '../notification-source-icon'
import { Tooltip, TooltipContent, TooltipTrigger } from '../ui/tooltip'
import { t } from '@lingui/core/macro'
import { Trans } from '@lingui/react/macro'

/** A notification as the server sends it. */
export interface Notification {
  id: string
  app: string
  topic: string
  object: string
  content: string
  link: string
  sender?: string
  count: number
  created: number
  read: number
}

/**
 * One notification row, rendered by the shell menu and by an app's own menu.
 */
export function NotificationItem({
  notification,
  onClick,
  onMiddleClick,
  actions,
}: {
  notification: Notification
  onClick?: (notification: Notification) => void
  onMiddleClick?: (notification: Notification) => void
  /**
   * Trailing control for the row, supplied by the consumer: this library cannot
   * read the notifications service. No actions supplied, no control rendered.
   */
  actions?: (notification: Notification) => React.ReactNode
}) {
  const { formatTimestamp } = useFormat()
  const isUnread = notification.read === 0

  return (
    <div
      className={cn(
        'group flex w-full items-start gap-3 px-4 py-2 transition-colors hover:bg-hover',
        isUnread ? 'bg-muted/30' : 'bg-transparent'
      )}
    >
      <button
        type='button'
        onClick={() => onClick?.(notification)}
        onAuxClick={(e) => {
          if (e.button === 1) {
            e.preventDefault()
            onMiddleClick?.(notification)
          }
        }}
        className='flex flex-1 items-start gap-3 text-start'
      >
        <NotificationSourceIcon
          app={notification.app}
          sender={notification.sender}
          isUnread={isUnread}
        />
        <div className='flex-1 min-w-0 space-y-0.5'>
          <p
            className={cn(
              'text-sm leading-snug',
              isUnread ? 'font-medium text-foreground' : 'text-muted-foreground'
            )}
          >
            {notification.content}
          </p>
          <p className='text-[11px] text-muted-foreground/70'>
            {formatTimestamp(notification.created)}
          </p>
        </div>
      </button>
      {actions?.(notification)}
    </div>
  )
}

/**
 * The scrolling list, rendered by both menus. Link policy stays with the caller
 * - the two menus differ on whether an off-origin link may be opened at all.
 */
export function NotificationList({
  notifications,
  isLoading,
  isError,
  onClick,
  onMiddleClick,
  actions,
  className,
}: {
  notifications: Notification[]
  isLoading?: boolean
  isError?: boolean
  onClick?: (notification: Notification) => void
  onMiddleClick?: (notification: Notification) => void
  actions?: (notification: Notification) => React.ReactNode
  className?: string
}) {
  if (isLoading) {
    return <ListSkeleton variant='simple' count={4} avatar className='p-3' />
  }

  if (isError) {
    return (
      <div className='flex flex-col items-center justify-center px-4 py-8 text-center'>
        <Bell className='mb-3 size-8 text-muted-foreground/20' />
        <p className='text-sm font-medium text-foreground'>
          <Trans>Couldn't load notifications</Trans>
        </p>
      </div>
    )
  }

  if (notifications.length === 0) {
    return (
      <div className='flex flex-col items-center justify-center px-4 py-8 text-center'>
        <Bell className='mb-3 size-8 text-muted-foreground/20' />
        <p className='text-sm font-medium text-foreground'>
          <Trans>No unread notifications</Trans>
        </p>
      </div>
    )
  }

  return (
    <div className={cn('divide-y divide-border/40', className)}>
      {notifications.map((notification) => (
        <NotificationItem
          key={notification.id}
          notification={notification}
          onClick={onClick}
          onMiddleClick={onMiddleClick}
          actions={actions}
        />
      ))}
    </div>
  )
}

// Hosts an operator has vouched for as redirect targets, mirroring the
// standalone notifications page. Empty by default: notification links are
// app-authored and this menu runs in the trusted top window.
const TRUSTED_EXTERNAL_REDIRECT_HOSTS = (
  import.meta.env.VITE_TRUSTED_REDIRECT_HOSTS ?? ''
)
  .split(',')
  .map((host: string) => host.trim().toLowerCase())
  .filter(Boolean)

/**
 * Resolve a notification's link to something safe to navigate to, or null.
 * Returning null covers unsafe schemes (javascript:, data:) and off-origin
 * hosts alike; the caller reports the refusal rather than navigating.
 */
function safeNotificationTarget(link: string): string | null {
  return getSafeNavigationTarget(link, window.location.origin, {
    trustedExternalHosts: TRUSTED_EXTERNAL_REDIRECT_HOSTS,
  })
}

export function NotificationsSection({
  onClose,
  notifications,
  markAsRead,
  markAllAsRead,
  actions,
}: {
  onClose: () => void
  notifications: Notification[]
  markAsRead: (id: string) => void
  markAllAsRead: () => void
  actions?: (notification: Notification) => React.ReactNode
}) {
  const unread = notifications.filter((n) => n.read === 0)

  return (
    <div className='py-1'>
      <div className='flex items-center justify-between px-2 pb-1'>
        <span className='text-xs font-medium text-muted-foreground'>
          <Trans>Notifications: {unread.length}</Trans>
        </span>
        <div className='flex gap-1'>
          {unread.length > 0 && (
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  aria-label={t`Mark all as read`}
                  onClick={markAllAsRead}
                  className='rounded p-1.5 hover:bg-hover active:bg-interactive-active'
                >
                  <Check className='size-4' />
                </button>
              </TooltipTrigger>
              <TooltipContent>{t`Mark all as read`}</TooltipContent>
            </Tooltip>
          )}
          <Tooltip>
            <TooltipTrigger asChild>
              <a
                aria-label={t`View all notifications`}
                href='/notifications/'
                onClick={onClose}
                className='rounded p-1.5 hover:bg-hover active:bg-interactive-active'
              >
                <ExternalLink className='size-4' />
              </a>
            </TooltipTrigger>
            <TooltipContent>{t`View all notifications`}</TooltipContent>
          </Tooltip>
        </div>
      </div>

      {unread.length > 0 && (
        <ScrollArea className='max-h-[calc(100vh-8rem)]'>
          <NotificationList
            notifications={unread}
            onClick={(notif) => {
              markAsRead(notif.id)
              if (!notif.link) return
              const target = safeNotificationTarget(notif.link)
              if (!target) {
                toast.error(t`Blocked navigation to untrusted link`)
                return
              }
              shellNavigateExternal(target)
            }}
            onMiddleClick={(notif) => {
              markAsRead(notif.id)
              if (!notif.link) return
              const target = safeNotificationTarget(notif.link)
              if (!target) {
                toast.error(t`Blocked navigation to untrusted link`)
                return
              }
              window.open(target, '_blank', 'noopener,noreferrer')
            }}
            actions={actions}
          />
        </ScrollArea>
      )}
    </div>
  )
}
