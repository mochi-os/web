import { Check, ExternalLink } from 'lucide-react'
import { cn } from '../../lib/utils'
import { shellNavigateExternal } from '../../lib/shell-bridge'
import { useFormat } from '../../hooks/use-format'
import type { Notification } from '../notifications-dropdown'
import { NotificationCategoryButton } from '../notification-category-button'
import { ScrollArea } from '../ui/scroll-area'
import { t } from '@lingui/core/macro'

export { type Notification }

export function NotificationItem({
  notification,
  onClick,
  onMiddleClick,
}: {
  notification: Notification
  onClick?: (notification: Notification) => void
  onMiddleClick?: (notification: Notification) => void
}) {
  const isUnread = notification.read === 0
  const { formatTimestamp } = useFormat()

  return (
    <div
      className={cn(
        'flex w-full items-start gap-2 rounded-md px-2 py-2 text-sm transition-colors hover:bg-interactive-hover',
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
      <NotificationCategoryButton
        app={notification.app}
        topic={notification.topic}
        object={notification.object}
        className='mt-0.5 shrink-0'
      />
    </div>
  )
}

export function NotificationsSection({
  onClose,
  notifications,
  markAsRead,
  markAllAsRead,
}: {
  onClose: () => void
  notifications: Notification[]
  markAsRead: (id: string) => void
  markAllAsRead: () => void
}) {
  const unread = notifications.filter((n) => n.read === 0)

  return (
    <div className='py-1'>
      <div className='flex items-center justify-between px-2 pb-1'>
        <span className='text-xs font-medium text-muted-foreground'>
          Notifications: {unread.length}
        </span>
        <div className='flex gap-1'>
          {unread.length > 0 && (
            <button
              aria-label={t`Mark all as read`}
              onClick={markAllAsRead}
              className='rounded p-1.5 hover:bg-interactive-hover active:bg-interactive-active'
            >
              <Check className='size-4' />
            </button>
          )}
          <a
            aria-label={t`View all notifications`}
            href='/notifications/'
            onClick={onClose}
            className='rounded p-1.5 hover:bg-interactive-hover active:bg-interactive-active'
          >
            <ExternalLink className='size-4' />
          </a>
        </div>
      </div>

      {unread.length > 0 && (
        <ScrollArea className='max-h-[calc(100vh-8rem)]'>
          <div className='space-y-0.5 px-1'>
            {unread.map((n) => (
              <NotificationItem
                key={n.id}
                notification={n}
                onClick={(notif) => {
                  markAsRead(notif.id)
                  if (notif.link) {
                    shellNavigateExternal(notif.link)
                  }
                }}
                onMiddleClick={(notif) => {
                  markAsRead(notif.id)
                  if (notif.link) {
                    window.open(notif.link, '_blank')
                  }
                }}
              />
            ))}
          </div>
        </ScrollArea>
      )}
    </div>
  )
}
