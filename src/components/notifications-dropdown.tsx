import { useState, useEffect } from 'react'
import { Trans } from '@lingui/react/macro'
import { Bell, Check, ExternalLink } from 'lucide-react'
import { cn } from '../lib/utils'
import { shellNavigateExternal } from '../lib/shell-bridge'
import { useFormat } from '../hooks/use-format'
import { useScreenSize } from '../hooks/use-screen-size'
import { Button } from './ui/button'

import { Popover, PopoverContent, PopoverTrigger } from './ui/popover'
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from './ui/drawer'
import { ScrollArea } from './ui/scroll-area'
import { Switch } from './ui/switch'
import { Label } from './ui/label'
import { t } from '@lingui/core/macro'

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

interface NotificationItemProps {
  notification: Notification
  onClick?: (notification: Notification) => void
}

function NotificationItem({ notification, onClick }: NotificationItemProps) {
  const isUnread = notification.read === 0
  const { formatTimestamp } = useFormat()

  return (
    <button
      type='button'
      onClick={() => onClick?.(notification)}
      className={cn(
        'group flex w-full items-start gap-3 px-4 py-3 text-start transition-colors hover:bg-muted/50',
        isUnread ? 'bg-muted/30' : 'bg-transparent'
      )}
    >
      <div
        className={cn(
          'mt-1.5 size-2.5 shrink-0 rounded-full transition-colors',
          isUnread
            ? 'bg-primary'
            : 'bg-transparent group-hover:bg-muted-foreground/20'
        )}
      />
      <div className='flex-1 min-w-0 space-y-1'>
        <p
          className={cn(
            'text-sm leading-snug',
            isUnread ? 'font-medium text-foreground' : 'text-muted-foreground'
          )}
        >
          {notification.content}
          {notification.count > 1 && (
            <span className='ms-1 inline-flex items-center justify-center rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-medium'>
              {notification.count}
            </span>
          )}
        </p>
        <p className='text-[11px] text-muted-foreground/70'>
          {formatTimestamp(notification.created)}
        </p>
      </div>
    </button>
  )
}

type NotificationsDropdownProps = {
  notifications?: Notification[]
  notificationsUrl?: string
  onMarkAllAsRead?: () => void
  onNotificationClick?: (notification: Notification) => void
  buttonClassName?: string
}

const STORAGE_KEY = 'notifications-show-all'

export function NotificationsDropdown({
  notifications = [],
  notificationsUrl,
  onMarkAllAsRead,
  onNotificationClick,
  buttonClassName,
}: NotificationsDropdownProps) {
  const { isDesktop } = useScreenSize()
  const [open, setOpen] = useState(false)
  const [showAll, setShowAll] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem(STORAGE_KEY) === 'true'
    }
    return false
  })

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, String(showAll))
  }, [showAll])

  const unreadCount = notifications.filter((n) => n.read === 0).length
  const displayedNotifications = showAll
    ? notifications
    : notifications.filter((n) => n.read === 0)

  const handleNotificationClick = (notification: Notification) => {
    onNotificationClick?.(notification)
    if (notification.link) {
      setOpen(false)
      shellNavigateExternal(notification.link)
    }
  }

  const triggerButton = (
    <Button
      variant='ghost'
      size='icon'
      className={cn('relative', buttonClassName)}
      aria-label={t`Notifications`}
    >
      <Bell className='size-5' />
      {unreadCount > 0 && (
        <span className='absolute right-0.5 top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-notification px-1 text-[10px] font-medium text-notification-foreground'>
          {unreadCount > 99 ? '99+' : unreadCount}
        </span>
      )}
    </Button>
  )

  const headerContent = (
    <div className='flex items-center justify-between border-b bg-muted/30 px-4 py-3'>
      <div className='flex items-center gap-2'>
        <span className='font-semibold text-sm'><Trans>Notifications</Trans></span>
        {unreadCount > 0 && (
          <span className='rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary'>
            {unreadCount}
          </span>
        )}
      </div>
      <div className='flex items-center gap-2'>
        <div className='flex items-center gap-2 pe-2 border-e me-2'>
          <Label
            htmlFor='show-all'
            className='text-[10px] uppercase font-medium text-muted-foreground tracking-wider cursor-pointer select-none'
          >
            <Trans>All</Trans>
          </Label>
          <Switch
            id='show-all'
            checked={showAll}
            onCheckedChange={setShowAll}
            className='scale-75 origin-right'
          />
        </div>
        {notificationsUrl && (
          <a
            href={notificationsUrl}
            onClick={() => setOpen(false)}
            className='text-muted-foreground hover:text-foreground transition-colors'
            title={t`View all`}
          >
            <ExternalLink className='size-4' />
          </a>
        )}
      </div>
    </div>
  )

  const listContent = (
    <ScrollArea className='max-h-[min(420px,80vh)] overflow-y-scroll'>
      <div className='flex flex-col'>
        {displayedNotifications.length === 0 ? (
          <div className='flex flex-col items-center justify-center py-12 text-center px-4'>
            <Bell className='size-8 text-muted-foreground/20 mb-3' />
            <p className='text-sm font-medium text-foreground'>
              {showAll ? "No notifications yet" : "You're all caught up!"}
            </p>
            <p className='text-xs text-muted-foreground mt-1 max-w-[180px]'>
              {showAll
                ? "We'll notify you when something important happens."
                : 'Check "All" to see your past notifications.'}
            </p>
          </div>
        ) : (
          <div className='divide-y divide-border/40'>
            {displayedNotifications.map((notification) => (
              <NotificationItem
                key={notification.id}
                notification={notification}
                onClick={handleNotificationClick}
              />
            ))}
          </div>
        )}
      </div>
    </ScrollArea>
  )

  const footerContent = unreadCount > 0 && (
    <div className='border-t bg-muted/30 p-2'>
      <Button
        variant='ghost'
        className='w-full justify-center h-8 text-xs text-muted-foreground hover:text-primary'
        onClick={() => onMarkAllAsRead?.()}
      >
        <Check className='me-2 size-3' />
        <Trans>Mark all as read</Trans>
      </Button>
    </div>
  )

  if (isDesktop) {
    return (
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>{triggerButton}</PopoverTrigger>
        <PopoverContent
          align='end'
          sideOffset={8}
          className='w-80 p-0 overflow-hidden shadow-lg border-border sm:w-96'
        >
          {headerContent}
          {listContent}
          {footerContent}
        </PopoverContent>
      </Popover>
    )
  }

  return (
    <Drawer open={open} onOpenChange={setOpen}>
      <DrawerTrigger asChild>{triggerButton}</DrawerTrigger>
      <DrawerContent>
        <DrawerHeader className='sr-only'>
          <DrawerTitle><Trans>Notifications</Trans></DrawerTitle>
        </DrawerHeader>
        {headerContent}
        {listContent}
        {footerContent}
      </DrawerContent>
    </Drawer>
  )
}
