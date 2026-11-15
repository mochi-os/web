// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: Apache-2.0

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { act, render } from '@testing-library/react'

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
    expect(MAP_TILES_DEFAULT.url).toBe(
      'https://tile.openstreetmap.org/{z}/{x}/{y}.png'
    )
  })

  it("renders the server's tile source and shows its credit as text", () => {
    render(
      <MapTilesProvider
        tiles={{
          url: 'https://tiles.example/{z}/{x}/{y}.png',
          attribution: '© <b>Provider</b>',
        }}
      >
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
    expect(L.tileLayer).toHaveBeenCalledWith(
      MAP_TILES_DEFAULT.url,
      expect.anything()
    )
  })
})

// A list of posts with maps builds only the maps that near the screen. The
// box stands at its own size until then, observed against the element the
// page scrolls in: inside the shell's sandboxed iframe the browser ignores
// the margin against the viewport, so a map observed there would be built
// only once already on screen.
describe('MapView lazy', () => {
  type Callback = (entries: Partial<IntersectionObserverEntry>[]) => void

  class FakeObserver {
    static instances: FakeObserver[] = []
    root: Element | Document | null
    rootMargin: string
    targets: Element[] = []
    disconnected = false
    constructor(
      public callback: Callback,
      options?: IntersectionObserverInit
    ) {
      this.root = options?.root ?? null
      this.rootMargin = options?.rootMargin ?? ''
      FakeObserver.instances.push(this)
    }
    observe(target: Element) {
      this.targets.push(target)
    }
    unobserve() {}
    disconnect() {
      this.disconnected = true
    }
    takeRecords() {
      return []
    }
  }

  const original = globalThis.IntersectionObserver

  beforeEach(() => {
    vi.mocked(L.map).mockClear()
    vi.mocked(L.tileLayer).mockClear()
    FakeObserver.instances = []
    globalThis.IntersectionObserver =
      FakeObserver as unknown as typeof IntersectionObserver
  })

  afterEach(() => {
    globalThis.IntersectionObserver = original
  })

  // An element that scrolls, as jsdom lays nothing out: its content is
  // taller than its box.
  function overflowing(element: HTMLElement) {
    Object.defineProperty(element, 'scrollHeight', { value: 2000 })
    Object.defineProperty(element, 'clientHeight', { value: 500 })
  }

  it('builds no map, and asks for no tiles, until its box nears the screen', () => {
    const { container } = render(<MapView lat={1} lon={2} lazy />)
    const box = container.firstElementChild as HTMLElement

    expect(L.map).not.toHaveBeenCalled()
    expect(L.tileLayer).not.toHaveBeenCalled()
    // The empty box keeps the map's own size, so building it moves nothing.
    expect(box.style.aspectRatio).toBe('2/1')
    expect(box.style.maxHeight).toBe('150px')

    const [observer] = FakeObserver.instances
    expect(observer.targets).toEqual([box])
    act(() => observer.callback([{ isIntersecting: true, target: box }]))

    expect(L.map).toHaveBeenCalledTimes(1)
    expect(vi.mocked(L.map).mock.calls[0][0]).toBe(box)
    expect(L.tileLayer).toHaveBeenCalledTimes(1)
    expect(observer.disconnected).toBe(true)
    expect(container.firstElementChild).toBe(box)
  })

  it('stays empty while its box is still far off', () => {
    render(<MapView lat={1} lon={2} lazy />)
    const [observer] = FakeObserver.instances
    act(() => observer.callback([{ isIntersecting: false }]))
    expect(L.map).not.toHaveBeenCalled()
  })

  it('is observed against the element the page scrolls in, with a margin', () => {
    // The inner element is set to scroll but holds all it contains; the
    // outer one is the one that scrolls. A ref is attached before the map's
    // effect runs, so the outer one overflows by the time it is measured.
    const { getByTestId } = render(
      <div
        data-testid='page'
        style={{ overflowY: 'auto' }}
        ref={(element) => {
          if (element) overflowing(element)
        }}
      >
        <div style={{ overflowY: 'auto' }}>
          <MapView lat={1} lon={2} lazy />
        </div>
      </div>
    )
    const [observer] = FakeObserver.instances
    expect(observer.root).toBe(getByTestId('page'))
    expect(observer.rootMargin).toBe('300px')
  })

  it('is observed against the viewport when nothing around it scrolls', () => {
    render(
      <div style={{ overflowY: 'auto' }}>
        <MapView lat={1} lon={2} lazy />
      </div>
    )
    const [observer] = FakeObserver.instances
    expect(observer.root).toBeNull()
  })

  it('builds at once without lazy', () => {
    render(<MapView lat={1} lon={2} />)
    expect(L.map).toHaveBeenCalledTimes(1)
    expect(FakeObserver.instances).toHaveLength(0)
  })
})
