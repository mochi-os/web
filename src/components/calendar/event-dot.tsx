// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: Apache-2.0

import { cn } from '../../lib/utils'
import type { CalendarEvent } from './types'

/**
 * An event's colour: the one place the views show it, before the title, so a
 * busy week stays calm and every event reads the same way. A tentative event's
 * dot is a ring.
 */
export function EventDot({
  event,
  className,
}: {
  event: Pick<CalendarEvent, 'colour' | 'status'>
  /** A size other than the grids' own. */
  className?: string
}) {
  const hollow = event.status === 'tentative'
  return (
    <span
      aria-hidden
      className={cn(
        'size-2 shrink-0 rounded-full',
        className,
        hollow && 'border-[1.5px]'
      )}
      style={
        hollow
          ? { borderColor: event.colour }
          : { backgroundColor: event.colour }
      }
    />
  )
}
