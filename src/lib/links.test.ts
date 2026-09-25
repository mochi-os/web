// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: Apache-2.0

import { describe, it, expect } from 'vitest'
import {
  FLIGHT_SERVICE_NAMES,
  FLIGHT_SERVICES,
  MAP_SERVICE_NAMES,
  MAP_SERVICES,
  flightLink,
  flightNumber,
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

describe('flightNumber', () => {
  it('recognises an airline code and a number, spaced or not, in any case', () => {
    expect(flightNumber('EI59')).toBe('EI59')
    expect(flightNumber('BA 123')).toBe('BA123')
    expect(flightNumber('U28642')).toBe('U28642')
    expect(flightNumber('9w 7')).toBe('9W7')
    expect(flightNumber(' lh1234a ')).toBe('LH1234A')
  })

  it("recognises the airline's name before its flight number", () => {
    expect(flightNumber('Aer Lingus EI59')).toBe('EI59')
    expect(flightNumber('Aer Lingus EI 59')).toBe('EI59')
    expect(flightNumber('alaska airlines as1342')).toBe('AS1342')
    expect(flightNumber('British Airways BA 123A')).toBe('BA123A')
  })

  it('leaves everything else alone', () => {
    for (const location of [
      'Meeting room',
      'Studio',
      'Studio 54',
      'EI59 gate 12',
      'Gate B12',
      'Terminal 2',
      'Alaska 1342',
      'A1',
      '12 34',
      'EI',
      'EI12345',
      '',
    ]) {
      expect(flightNumber(location)).toBeNull()
    }
  })
})
