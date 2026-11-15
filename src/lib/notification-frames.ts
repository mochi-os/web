// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: Apache-2.0

// The notifications app's socket frames, applied to a list of notifications a
// query holds. The shell's bell and the notifications page each hold the list
// the browser surface sees, and each applies the frames its own socket hears,
// so the list ends as a fetch of it would answer without being downloaded
// again for every notification, read and open chat.

import type { QueryClient, QueryKey } from '@tanstack/react-query'
import type { Notification } from '../components/layout/notification-menu'

/** A notifications socket frame, as the notifications app writes it. */
export interface NotificationFrame extends Partial<Notification> {
  type?: string
  /** On a "new" frame: whether the browser surface lists the row at all. */
  web?: boolean
  /** On a clear_object frame: how many rows it changed. */
  changed?: number
}

/**
 * The list once a frame is applied to it, or null when only fetching the list
 * again can say: a frame from a notifications app too old to carry the row
 * whole, or a clear, which names no rows. The list stays as a fetch would
 * answer it: oldest first, a row hidden from the browser surface left out, a
 * row sent again replacing the one held.
 */
export function notificationsAfter(
  list: Notification[],
  frame: NotificationFrame
): Notification[] | null {
  const now = Math.floor(Date.now() / 1000)
  switch (frame.type) {
    case 'new': {
      if (
        typeof frame.web !== 'boolean' ||
        typeof frame.id !== 'string' ||
        typeof frame.created !== 'number'
      )
        return null
      const rest = list.filter((row) => row.id !== frame.id)
      if (!frame.web) return rest.length === list.length ? list : rest
      const row: Notification = {
        id: frame.id,
        app: frame.app ?? '',
        topic: frame.topic ?? '',
        object: frame.object ?? '',
        content: frame.content ?? '',
        link: frame.link ?? '',
        sender: frame.sender ?? '',
        count: frame.count ?? 1,
        created: frame.created,
        read: frame.read ?? 0,
      }
      const after = rest.findIndex((held) => held.created > row.created)
      return after < 0
        ? [...rest, row]
        : [...rest.slice(0, after), row, ...rest.slice(after)]
    }
    case 'read':
      if (typeof frame.id !== 'string') return null
      return list.map((row) =>
        row.id === frame.id && !row.read ? { ...row, read: now } : row
      )
    case 'read_all':
      return list.map((row) => (row.read ? row : { ...row, read: now }))
  }
  return null
}

/**
 * Apply a frame to the list the query at queryKey holds, as `{ data }`, or
 * fetch the list again when the frame cannot be applied. A fetch already under
 * way answers from before the frame and would overwrite it on landing, so then
 * the list is fetched again, which cancels that one.
 *
 * Returns whether the frame concerns the list at all: false for a frame of any
 * other type, and for a clear that changed no row, which the notifications app
 * sends on every open of an object, for the phone.
 */
export function applyNotificationsFrame(
  queryClient: QueryClient,
  queryKey: QueryKey,
  frame: NotificationFrame
): boolean {
  // A categories frame says which rows the surface lists changed with a
  // topic's category or a category's destinations: it names none, so the list
  // is fetched.
  switch (frame.type) {
    case 'new':
    case 'read':
    case 'read_all':
    case 'clear_all':
    case 'clear_app':
    case 'clear_object':
    case 'categories':
      break
    default:
      return false
  }
  if (frame.type === 'clear_object' && frame.changed === 0) return false

  const fetching =
    queryClient.getQueryState(queryKey)?.fetchStatus === 'fetching'
  const held = fetching
    ? undefined
    : queryClient.getQueryData<{ data: Notification[] }>(queryKey)
  const next = held ? notificationsAfter(held.data, frame) : null
  if (held && next) {
    if (next !== held.data) {
      queryClient.setQueryData(queryKey, { ...held, data: next })
    }
    return true
  }
  void queryClient.invalidateQueries({ queryKey })
  return true
}
