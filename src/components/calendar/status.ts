// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: Apache-2.0

import { useCallback } from 'react'
import { useLingui } from '@lingui/react/macro'
import type { CalendarEvent } from './types'

/** An iCalendar STATUS as the views draw it: confirmed, the default, is none. */
export function eventStatus(value?: string): CalendarEvent['status'] {
  switch (value?.toUpperCase()) {
    case 'CANCELLED':
      return 'cancelled'
    case 'TENTATIVE':
      return 'tentative'
    default:
      return undefined
  }
}

/** The words for an event's status, or null for a confirmed one. */
export function useEventStatus(): (
  status: CalendarEvent['status']
) => string | null {
  const { t } = useLingui()
  return useCallback(
    (status: CalendarEvent['status']) => {
      if (status === 'cancelled')
        return t({ message: 'Cancelled', context: 'event status' })
      if (status === 'tentative')
        return t({ message: 'Tentative', context: 'event status' })
      return null
    },
    [t]
  )
}
