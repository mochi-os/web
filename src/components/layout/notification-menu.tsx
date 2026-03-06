import { Check, ExternalLink } from 'lucide-react'
import { cn } from '../../lib/utils'
import type { Notification } from '../notifications-dropdown'
import { ScrollArea } from '../ui/scroll-area'

export { type Notification }

export function formatTimestamp(timestamp: number): string {
  const now = Date.now() / 1000
  const diff = now - timestamp

  if (diff < 60) return 'Just now'
  if (diff < 3600) return `${Math.floor(diff / 60)}m`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`
  if (diff < 604800) return `${Math.floor(diff / 86400)}d`

  return new Date(timestamp * 1000).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  })
}

export function NotificationItem({
  notification,
  onClick,
}: {
  notification: Notification
  onClick?: (notification: Notification) => void
}) {
  const isUnread = notification.read === 0

  return (
    <button
      type='button'
      onClick={() => onClick?.(notification)}
      className={cn(
        'flex w-full items-start gap-2 rounded-md px-2 py-2 text-left text-sm transition-colors hover:bg-interactive-hover active:bg-interactive-active',
        isUnread && 'bg-muted/50'
      )}
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
              onClick={markAllAsRead}
              className='rounded p-1.5 hover:bg-interactive-hover active:bg-interactive-active'
            >
              <Check className='size-4' />
            </button>
          )}
          <a
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
                    window.location.href = notif.link
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
