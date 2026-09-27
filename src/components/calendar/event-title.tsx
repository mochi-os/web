// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: Apache-2.0

import { useLingui } from '@lingui/react/macro'
import { cn } from '../../lib/utils'
import type { CalendarEvent } from './types'

/**
 * An event's title, struck through when it is cancelled, and a muted stand-in
 * when it has none, as a subscription's or another client's may not.
 */
export function EventTitle({
  event,
  className,
}: {
  event: Pick<CalendarEvent, 'title' | 'status'>
  className?: string
}) {
  const { t } = useLingui()
  return (
    <span
      className={cn(
        'min-w-0 truncate',
        className,
        !event.title && 'text-muted-foreground',
        event.status === 'cancelled' && 'line-through'
      )}
    >
      {event.title || t`(No title)`}
    </span>
  )
}
