// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: Apache-2.0

import { describe, it, expect } from 'vitest'
import {
  FLIGHT_SERVICE_NAMES,
  FLIGHT_SERVICES,
  MAP_SERVICE_NAMES,
  MAP_SERVICES,
  flightLink,
  flightService,
  mapLink,
  mapService,
} from './links'

describe('the map and flight preferences resolve to a service', () => {
  it('reads a known service and falls back to the first for anything else', () => {
    expect(mapService('google')).toBe('google')
    expect(mapService('openstreetmap')).toBe('openstreetmap')
    expect(mapService(undefined)).toBe('openstreetmap')
    expect(mapService('')).toBe('openstreetmap')
    expect(mapService('auto')).toBe('openstreetmap')
    expect(mapService('apple')).toBe('openstreetmap')
    expect(flightService('flightaware')).toBe('flightaware')
    expect(flightService(undefined)).toBe('flightradar24')
    expect(flightService('bing')).toBe('flightradar24')
  })

  it('names every service, first is the default', () => {
    expect(MAP_SERVICES[0]).toBe('openstreetmap')
    expect(FLIGHT_SERVICES[0]).toBe('flightradar24')
    expect(Object.keys(MAP_SERVICE_NAMES).sort()).toEqual(
      [...MAP_SERVICES].sort()
    )
    expect(Object.keys(FLIGHT_SERVICE_NAMES).sort()).toEqual(
      [...FLIGHT_SERVICES].sort()
    )
  })
})

describe('mapLink', () => {
  it('searches OpenStreetMap by default and Google when chosen', () => {
    expect(mapLink('Meeting room')).toBe(
      'https://www.openstreetmap.org/search?query=Meeting%20room'
    )
    expect(mapLink('Meeting room', 'openstreetmap')).toBe(
      'https://www.openstreetmap.org/search?query=Meeting%20room'
    )
    expect(mapLink('Meeting room', 'google')).toBe(
      'https://www.google.com/maps/search/?api=1&query=Meeting%20room'
    )
  })

  it('encodes the location and trims it', () => {
    expect(mapLink('  12 Example St & Co, Springfield ', 'google')).toBe(
      'https://www.google.com/maps/search/?api=1&query=12%20Example%20St%20%26%20Co%2C%20Springfield'
    )
  })
})

describe('flightLink', () => {
  it('opens the flight number on Flightradar24 by default and FlightAware when chosen', () => {
    expect(flightLink('EI59')).toBe(
      'https://www.flightradar24.com/data/flights/ei59'
    )
    expect(flightLink('EI59', 'flightaware')).toBe(
      'https://www.flightaware.com/live/flight/EI59'
    )
  })

  it('normalises spacing and case', () => {
    expect(flightLink('ba 123')).toBe(
      'https://www.flightradar24.com/data/flights/ba123'
    )
    expect(flightLink('ba 123', 'flightaware')).toBe(
      'https://www.flightaware.com/live/flight/BA123'
    )
  })
})
