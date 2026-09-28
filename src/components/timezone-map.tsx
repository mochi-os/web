// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: Apache-2.0

import { useEffect, useState } from 'react'
import { cn } from '../lib/utils'
import { zoneCity } from '../lib/locale-format'
import { useFormat } from '../hooks/use-format'

/**
 * The map's data, built by claude/scripts/timezone-map.py from
 * OpenStreetMap-derived boundaries and Natural Earth's coastlines, in a 960
 * by 400 equirectangular frame cropped at 60 degrees south. Three layers:
 * `oceans`, the Etc/GMT zones as bands beneath everything; `zones`, each
 * zone whole, drawn invisible so a click in a zone's waters still picks it;
 * and `land`, each zone clipped to its coastlines, which is what shows.
 * Loaded when the map first shows: a few hundred kilobytes no page needs
 * before then.
 */
export interface TimezoneMapData {
  attribution: string
  release: string
  width: number
  height: number
  oceans: Record<string, string>
  zones: Record<string, string>
  land: Record<string, string>
}

let loading: Promise<TimezoneMapData> | null = null

function loadMap(): Promise<TimezoneMapData> {
  loading ??= import('../data/timezones.json').then(
    (module) => (module.default ?? module) as TimezoneMapData
  )
  return loading
}

// The data's licence notice, verbatim in every locale.
const ATTRIBUTION = '© OpenStreetMap contributors'

// The layers at rest: the sea bands edged faintly, the whole zones invisible,
// the land a quiet stone with hairline coasts.
const SEA = 'fill-transparent stroke-sky-200 stroke-[0.3] dark:stroke-slate-700'
const ZONE = 'fill-transparent'
const LAND =
  'fill-stone-300 stroke-white stroke-[0.3] dark:fill-stone-600 dark:stroke-slate-900'

export interface TimezoneMapProps {
  /** The chosen zone, drawn filled. */
  value: string
  /** A zone the list is pointing at, drawn tinted. */
  hovered?: string | null
  onHover?: (zone: string | null) => void
  onSelect: (zone: string) => void
  className?: string
}

/**
 * A world map of the time zones: hover names a zone and tells its time, a
 * click chooses it. The chosen zone fills in the primary colour and the one
 * pointed at in a tint of it. Where two zones cover the same ground, as
 * Shanghai and Urumqi do, the one drawn later is the one a click picks. The
 * list beside the map stays the keyboard path, so the map itself is hidden
 * from assistive technology.
 */
export function TimezoneMap({
  value,
  hovered = null,
  onHover,
  onSelect,
  className,
}: TimezoneMapProps) {
  const format = useFormat()
  const [data, setData] = useState<TimezoneMapData | null>(null)
  const [own, setOwn] = useState<string | null>(null)
  const pointed = hovered ?? own

  useEffect(() => {
    let cancelled = false
    loadMap().then((loaded) => {
      if (!cancelled) setData(loaded)
    })
    return () => {
      cancelled = true
    }
  }, [])

  const point = (zone: string | null) => {
    setOwn(zone)
    onHover?.(zone)
  }

  const state = (zone: string) =>
    zone === value ? 'fill-primary' : zone === pointed ? 'fill-primary/35' : ''

  const layer = (
    name: 'sea' | 'zone' | 'land',
    paths: Record<string, string>,
    rest: string
  ) =>
    Object.entries(paths).map(([zone, path]) => (
      <path
        key={zone}
        d={path}
        data-zone={zone}
        data-layer={name}
        className={cn('cursor-pointer', state(zone) || rest)}
        onPointerEnter={() => point(zone)}
        onPointerLeave={() => point(null)}
        onClick={() => onSelect(zone)}
      />
    ))

  const width = data?.width ?? 960
  const height = data?.height ?? 400

  return (
    <div className={cn('space-y-1', className)}>
      <div className='relative'>
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className='h-auto w-full rounded-md'
          aria-hidden
          data-testid='timezone-map'
        >
          <rect
            width={width}
            height={height}
            className='fill-sky-50 dark:fill-slate-900'
          />
          {data && layer('sea', data.oceans, SEA)}
          {data && layer('zone', data.zones, ZONE)}
          {data && layer('land', data.land, LAND)}
        </svg>
        <span className='bg-background/60 text-muted-foreground absolute right-1 bottom-1 rounded px-1 text-[8px] leading-3'>
          {ATTRIBUTION}
        </span>
      </div>
      <div
        className='text-muted-foreground min-h-4 truncate text-xs'
        data-testid='timezone-pointed'
      >
        {pointed
          ? `${zoneCity(pointed)} · ${format.formatClock(new Date(), pointed)}`
          : ''}
      </div>
    </div>
  )
}
