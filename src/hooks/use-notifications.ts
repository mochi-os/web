// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: Apache-2.0

// Notifications hook — stub for API compatibility.
// Notifications are handled entirely by the menu app in the shell.
// Authenticated users always use the shell; unauthenticated users have no notifications.

import { useQuery } from '@tanstack/react-query'
import type { Notification } from '../components/notifications-dropdown'

export interface NotificationCount {
  count: number
  total: number
}

interface NotificationsListResponse {
  data: Notification[]
  count: number
  total: number
}

// Query keys for notifications (used by menu app to invalidate)
export const notificationKeys = {
  all: () => ['notifications'] as const,
  list: () => [...notificationKeys.all(), 'list'] as const,
}

export function useNotificationsQuery() {
  return useQuery<NotificationsListResponse>({
    queryKey: notificationKeys.list(),
    queryFn: () => Promise.resolve({ data: [], count: 0, total: 0 }),
    enabled: false,
  })
}

export function useMarkAsReadMutation() {
  return { mutate: (_id: string) => {}, isPending: false }
}

export function useMarkAllAsReadMutation() {
  return { mutate: () => {}, isPending: false }
}

export function useNotificationWebSocket() {}

export function useNotifications() {
  return {
    notifications: [] as Notification[],
    count: { count: 0, total: 0 },
    isLoading: false,
    isError: false,
    unreadCount: 0,
    markAsRead: (_id: string) => {},
    markAllAsRead: () => {},
    isMarkingAsRead: false,
    isMarkingAllAsRead: false,
  }
}
