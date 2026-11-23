// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: Apache-2.0

import { useCallback } from 'react'
import { useLingui } from '@lingui/react/macro'
import { useFormat } from '../../hooks/use-format'
import { descriptionText } from '../../lib/html'
import { coveredDays } from './layout'
import { useEventStatus } from './status'
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
  const status = useEventStatus()
  return useCallback(
    (event: CalendarEvent) => {
      // The days the grids draw it on: an all-day occurrence's by its own
      // date, never its instants, which are midnight in whatever zone it
      // was expanded in; a timed one's in the zone each end was written in,
      // as its block and chip are labelled.
      const covered = coveredDays(event, format.zonedDay)
      const oneDay = covered.start === covered.finish
      let span: string
      if (event.allday) {
        const noon = (day: string) =>
          new Date(format.timestampAt(day, 720) * 1000)
        span = oneDay
          ? format.formatLongDate(noon(covered.start))
          : format.formatDayRange(noon(covered.start), noon(covered.finish))
      } else {
        const start = new Date(event.start * 1000)
        const finish = new Date(event.finish * 1000)
        const zone = event.zone ?? {}
        if (oneDay) {
          const day = format.formatLongDate(start, zone.start)
          const from = format.formatClock(start, zone.start)
          const to = format.formatClock(finish, zone.finish)
          span = t`${day}, ${from} to ${to}`
        } else {
          const from = `${format.formatLongDate(start, zone.start)} ${format.formatClock(start, zone.start)}`
          const to = `${format.formatLongDate(finish, zone.finish)} ${format.formatClock(finish, zone.finish)}`
          span = t`${from} to ${to}`
        }
      }
      const lines = [event.title || t`(No title)`]
      const state = status(event.status)
      if (state) lines.push(state)
      lines.push(span)
      if (event.location) lines.push(event.location)
      if (event.description) {
        // A subscription's description may be HTML; a title attribute can
        // only carry its text.
        const text = descriptionText(event.description)
        lines.push(text.length > HEAD ? `${text.slice(0, HEAD)}…` : text)
      }
      return lines.join('\n')
    },
    [t, format, status]
  )
}
