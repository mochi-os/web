// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: Apache-2.0

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render } from '@testing-library/react'

vi.mock('leaflet', () => {
  const layer = { addTo: vi.fn() }
  const marker = { addTo: vi.fn(), bindPopup: vi.fn() }
  marker.addTo.mockReturnValue(marker)
  const map = {
    setView: vi.fn(),
    fitBounds: vi.fn(),
    remove: vi.fn(),
    getContainer: () => document.createElement('div'),
  }
  return {
    default: {
      map: vi.fn(() => map),
      tileLayer: vi.fn(() => layer),
      control: { attribution: vi.fn(() => ({ addTo: vi.fn() })) },
      marker: vi.fn(() => marker),
      divIcon: vi.fn(() => ({})),
      polyline: vi.fn(() => ({ addTo: vi.fn() })),
      latLngBounds: vi.fn(() => ({})),
    },
  }
})

import L from 'leaflet'
import { MapView, MapTilesProvider, MAP_TILES_DEFAULT } from './map-view'

describe('MapView tiles', () => {
  beforeEach(() => {
    vi.mocked(L.tileLayer).mockClear()
  })

  it('renders OpenStreetMap tiles with their credit when nothing is configured', () => {
    render(<MapView lat={1} lon={2} />)
    expect(L.tileLayer).toHaveBeenCalledWith(
      MAP_TILES_DEFAULT.url,
      expect.objectContaining({ attribution: '© OpenStreetMap contributors' })
    )
    expect(MAP_TILES_DEFAULT.url).toBe('https://tile.openstreetmap.org/{z}/{x}/{y}.png')
  })

  it("renders the server's tile source and shows its credit as text", () => {
    render(
      <MapTilesProvider tiles={{ url: 'https://tiles.example/{z}/{x}/{y}.png', attribution: '© <b>Provider</b>' }}>
        <MapView lat={1} lon={2} />
      </MapTilesProvider>
    )
    expect(L.tileLayer).toHaveBeenCalledWith(
      'https://tiles.example/{z}/{x}/{y}.png',
      expect.objectContaining({ attribution: '© &lt;b&gt;Provider&lt;/b&gt;' })
    )
  })

  it('falls back to the default when the server sends an empty source', () => {
    render(
      <MapTilesProvider tiles={{ url: '', attribution: '' }}>
        <MapView lat={1} lon={2} />
      </MapTilesProvider>
    )
    expect(L.tileLayer).toHaveBeenCalledWith(MAP_TILES_DEFAULT.url, expect.anything())
  })
})
