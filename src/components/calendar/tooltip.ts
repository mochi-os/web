// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: Apache-2.0

import { useCallback } from 'react'
import { useLingui } from '@lingui/react/macro'
import { useFormat } from '../../hooks/use-format'
import type { CalendarEvent } from './types'

/** How much of a description a hover tooltip carries. */
const HEAD = 200

/**
 * The hover text for an event block: its title, when it is, where it is and
 * the first lines of its description. A native title attribute rather than a
 * tooltip component - it has to work on a block the pointer is also dragging.
 */
export function useEventTooltip(): (event: CalendarEvent) => string {
  const { t } = useLingui()
  const format = useFormat()
  return useCallback(
    (event: CalendarEvent) => {
      const start = new Date(event.start * 1000)
      const last = new Date(Math.max(event.start, event.finish - 1) * 1000)
      const oneDay = format.zonedDay(start) === format.zonedDay(last)
      let span: string
      if (event.allday) {
        span = oneDay
          ? format.formatLongDate(start)
          : format.formatDayRange(start, last)
      } else if (oneDay) {
        const day = format.formatLongDate(start)
        const from = format.formatClock(start)
        const to = format.formatClock(new Date(event.finish * 1000))
        span = t`${day}, ${from} to ${to}`
      } else {
        const from = `${format.formatLongDate(start)} ${format.formatClock(start)}`
        const to = `${format.formatLongDate(new Date(event.finish * 1000))} ${format.formatClock(new Date(event.finish * 1000))}`
        span = t`${from} to ${to}`
      }
      const lines = [event.title, span]
      if (event.location) lines.push(event.location)
      if (event.description) {
        lines.push(
          event.description.length > HEAD
            ? `${event.description.slice(0, HEAD)}…`
            : event.description
        )
      }
      return lines.join('\n')
    },
    [t, format]
  )
}
