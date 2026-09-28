// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: Apache-2.0

import { useMemo } from 'react'
import { useLocale } from '../context/locale-provider'
import { flightLink, mapLink } from '../lib/links'

/**
 * Links that follow the user's preferences: where a location and a flight
 * number open. Read the preferences here rather than in each app, so a change
 * on the settings Links page reaches every open app through the shell.
 */
export function useLinks() {
  const { locale } = useLocale()
  return useMemo(
    () => ({
      /** A map search for a free-text location. */
      map: (location: string) => mapLink(location, locale.maps),
      /** A flight's page on the user's tracker, by its number. */
      flight: (flight: string) => flightLink(flight, locale.flights),
    }),
    [locale.maps, locale.flights]
  )
}
