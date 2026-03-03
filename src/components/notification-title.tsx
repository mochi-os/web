import { useEffect } from 'react'
import { usePageTitleStore } from '../stores/page-title-store'
import { useNotificationsQuery } from '../hooks/use-notifications'

// Combines the page title with notification count and sets document.title.
// Place this component at the root of your app.
export function NotificationTitle() {
  const title = usePageTitleStore((state) => state.title)
  const { data } = useNotificationsQuery()
  const unreadCount = data?.data?.filter((n) => n.read === 0).length ?? 0

  useEffect(() => {
    const baseTitle = title || 'Mochi'
    document.title = unreadCount > 0 ? `(${unreadCount}) ${baseTitle}` : baseTitle
  }, [title, unreadCount])

  return null
}
