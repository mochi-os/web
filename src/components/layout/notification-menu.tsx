// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: Apache-2.0

import { Check, ExternalLink } from 'lucide-react'
import { cn } from '../../lib/utils'
import { shellNavigateExternal } from '../../lib/shell-bridge'
import { getSafeNavigationTarget } from '../../lib/safe-navigation'
import { toast } from '../../lib/toast-utils'
import { useFormat } from '../../hooks/use-format'
import type { Notification } from '../notifications-dropdown'
import { ScrollArea } from '../ui/scroll-area'
import { Tooltip, TooltipContent, TooltipTrigger } from '../ui/tooltip'
import { t } from '@lingui/core/macro'
import { Trans } from '@lingui/react/macro'

export { type Notification }

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
   * Trailing control for the row, supplied by the consumer. The category
   * picker lives here in practice, and it needs data from the notifications
   * service - which this library cannot read on any app's behalf, so it does
   * not try. No actions supplied, no control rendered.
   */
  actions?: (notification: Notification) => React.ReactNode
}) {
  const isUnread = notification.read === 0
  const { formatTimestamp } = useFormat()

  return (
    <div
      className={cn(
        'flex w-full items-start gap-2 rounded-md px-2 py-2 text-sm transition-colors hover:bg-hover',
        isUnread && 'bg-muted/50'
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
        className='flex flex-1 items-start gap-2 text-start'
      >
        <div
          className={cn('mt-1.5 size-2 rounded-full', isUnread && 'bg-primary')}
        />
        <div className='flex-1 min-w-0'>
          <p className={cn('truncate', isUnread && 'font-medium')}>
            {notification.content}
          </p>
          <p className='text-[11px] text-muted-foreground'>
            {formatTimestamp(notification.created)}
          </p>
        </div>
      </button>
      {actions?.(notification)}
    </div>
  )
}

// Hosts an operator has vouched for as redirect targets, mirroring the
// standalone notifications page so both views agree. Empty by default: a
// notification link is app-authored, and this menu runs in the trusted top
// window on any direct URL or deep link, where no shell filter stands between
// the link and window.location.
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
          <div className='space-y-0.5 px-1'>
            {unread.map((n) => (
              <NotificationItem
                key={n.id}
                notification={n}
                actions={actions}
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
              />
            ))}
          </div>
        </ScrollArea>
      )}
    </div>
  )
}
