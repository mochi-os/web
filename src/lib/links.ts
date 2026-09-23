// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: Apache-2.0

// Where a link opens: the user's `maps` and `flights` preferences, which the
// settings app's Links page sets and every app reads through useLinks(). An
// unknown or missing value is the first service, so a server that predates a
// preference behaves as if it were set to its default.

export const MAP_SERVICES = ['openstreetmap', 'google'] as const
export type MapService = (typeof MAP_SERVICES)[number]

export const FLIGHT_SERVICES = ['flightradar24', 'flightaware'] as const
export type FlightService = (typeof FLIGHT_SERVICES)[number]

/* eslint-disable lingui/no-unlocalized-strings -- brand names, verbatim in
   every locale */
/** Brand names, verbatim in every locale. */
export const MAP_SERVICE_NAMES: Record<MapService, string> = {
  openstreetmap: 'OpenStreetMap',
  google: 'Google Maps',
}

export const FLIGHT_SERVICE_NAMES: Record<FlightService, string> = {
  flightradar24: 'Flightradar24',
  flightaware: 'FlightAware',
}
/* eslint-enable lingui/no-unlocalized-strings */

export function mapService(value: string | undefined): MapService {
  return (MAP_SERVICES as readonly string[]).includes(value ?? '')
    ? (value as MapService)
    : MAP_SERVICES[0]
}

export function flightService(value: string | undefined): FlightService {
  return (FLIGHT_SERVICES as readonly string[]).includes(value ?? '')
    ? (value as FlightService)
    : FLIGHT_SERVICES[0]
}

/** A map search for a free-text location on the chosen service. */
export function mapLink(location: string, service?: string): string {
  const query = encodeURIComponent(location.trim())
  switch (mapService(service)) {
    case 'google':
      return `https://www.google.com/maps/search/?api=1&query=${query}`
    default:
      return `https://www.openstreetmap.org/search?query=${query}`
  }
}

/**
 * A flight's page on the chosen tracker, by its number as calendars carry it:
 * an airline code and a number, with or without a space, in any case.
 */
export function flightLink(flight: string, service?: string): string {
  const number = flight.replace(/\s+/g, '').toUpperCase()
  switch (flightService(service)) {
    case 'flightaware':
      return `https://www.flightaware.com/live/flight/${encodeURIComponent(number)}`
    default:
      return `https://www.flightradar24.com/data/flights/${encodeURIComponent(number.toLowerCase())}`
  }
}
