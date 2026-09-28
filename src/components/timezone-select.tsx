// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: Apache-2.0

import { useState, useMemo } from 'react'
import { Trans, useLingui } from '@lingui/react/macro'
import { Check, ChevronsUpDown, Globe } from 'lucide-react'
import { cn } from '../lib/utils'
import { zoneCity, offsetLabel, seaTimezones } from '../lib/locale-format'
import { Button } from './ui/button'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from './ui/command'
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover'
import { TimezoneMap } from './timezone-map'
import { t } from '@lingui/core/macro'

function getTimezones(): string[] {
  try {
    return (
      (
        Intl as { supportedValuesOf?: (key: string) => string[] }
      ).supportedValuesOf?.('timeZone') ?? []
    )
  } catch {
    return []
  }
}

function getBrowserTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone
  } catch {
    return 'UTC'
  }
}

interface TimezoneSelectProps {
  value: string
  onChange: (value: string) => void
  disabled?: boolean
  /**
   * Offer "Detect from web browser" as a value. A preference does; an event's
   * own zone does not, since it has to name a zone.
   */
  auto?: boolean
  /**
   * A small, quiet trigger showing only the zone's city, for a control that
   * sits beneath a time field rather than in a row of its own.
   */
  compact?: boolean
  /** The trigger's accessible name, when its text alone does not say what it sets. */
  label?: string
  id?: string
}

/**
 * A time zone chosen from a world map or a searchable list. The map fills the
 * chosen zone, tints the one pointed at and names it with its current time;
 * the list beneath is the keyboard path and the only one on narrow screens.
 */
export function TimezoneSelect({
  value,
  onChange,
  disabled,
  auto = true,
  compact = false,
  label,
  id,
}: TimezoneSelectProps) {
  const { t: t_ } = useLingui()
  const [open, setOpen] = useState(false)
  const [hovered, setHovered] = useState<string | null>(null)
  const timezones = useMemo(() => getTimezones(), [])
  const sea = useMemo(() => seaTimezones(), [])
  const browserTimezone = useMemo(() => getBrowserTimezone(), [])
  // Each zone's offset now, read once the list opens: a few hundred
  // formatters, which is nothing once but not worth paying on every render.
  const offsets = useMemo(() => {
    if (!open) return new Map<string, string>()
    const now = new Date()
    return new Map(
      [...timezones, ...sea].map((tz) => [tz, offsetLabel(tz, now)])
    )
  }, [open, timezones, sea])

  // A sea zone is its offset from UTC, which is its whole name.
  const formatTimezone = (tz: string) =>
    tz.startsWith('Etc/GMT') ? zoneCity(tz) : tz.replace(/_/g, ' ')
  const displayValue =
    value === 'auto'
      ? `${t_`Detect from web browser`}: ${formatTimezone(browserTimezone)}`
      : formatTimezone(value)
  // The map fills the chosen zone; with "auto" that is the browser's.
  const chosen = value === 'auto' ? browserTimezone : value
  const choose = (tz: string) => {
    onChange(tz)
    setOpen(false)
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        {compact ? (
          <Button
            id={id}
            type='button'
            variant='ghost'
            size='sm'
            role='combobox'
            aria-expanded={open}
            aria-label={label}
            className='text-muted-foreground h-7 gap-1 px-1.5 text-xs font-normal'
            disabled={disabled}
          >
            <Globe className='size-3.5 shrink-0' aria-hidden />
            <span className='truncate'>{zoneCity(chosen)}</span>
          </Button>
        ) : (
          <Button
            id={id}
            type='button'
            variant='outline'
            role='combobox'
            aria-expanded={open}
            aria-label={label}
            className='w-full justify-between'
            disabled={disabled}
          >
            <span className='truncate'>{displayValue}</span>
            <ChevronsUpDown className='ms-2 h-4 w-4 shrink-0 opacity-50' />
          </Button>
        )}
      </PopoverTrigger>
      <PopoverContent
        className='w-[min(720px,calc(100vw-2rem))] p-0'
        align='start'
      >
        <TimezoneMap
          value={chosen}
          hovered={hovered}
          onHover={setHovered}
          onSelect={choose}
          className='hidden p-2 pb-0 sm:block'
        />
        <Command>
          <CommandInput placeholder={t`Search time zone...`} />
          <CommandList>
            <CommandEmpty>
              <Trans>No time zone found.</Trans>
            </CommandEmpty>
            <CommandGroup>
              {auto && (
                <CommandItem value='auto' onSelect={() => choose('auto')}>
                  <Check
                    className={cn(
                      'me-2 h-4 w-4 shrink-0',
                      value === 'auto' ? 'opacity-100' : 'opacity-0'
                    )}
                  />
                  <span className='truncate'>
                    <Trans>Detect from web browser</Trans>:{' '}
                    {formatTimezone(browserTimezone)}
                  </span>
                </CommandItem>
              )}
              {timezones.map((tz) => (
                <CommandItem
                  key={tz}
                  value={tz}
                  keywords={[offsets.get(tz) ?? '']}
                  onSelect={() => choose(tz)}
                  onPointerEnter={() => setHovered(tz)}
                  onPointerLeave={() => setHovered(null)}
                >
                  <Check
                    className={cn(
                      'me-2 h-4 w-4 shrink-0',
                      value === tz ? 'opacity-100' : 'opacity-0'
                    )}
                  />
                  <span className='truncate'>{formatTimezone(tz)}</span>
                  <span className='text-muted-foreground ms-auto ps-3 text-xs'>
                    {offsets.get(tz)}
                  </span>
                </CommandItem>
              ))}
            </CommandGroup>
            <CommandGroup heading={t`At sea`}>
              {sea.map((tz) => (
                <CommandItem
                  key={tz}
                  value={tz}
                  keywords={[zoneCity(tz)]}
                  onSelect={() => choose(tz)}
                  onPointerEnter={() => setHovered(tz)}
                  onPointerLeave={() => setHovered(null)}
                >
                  <Check
                    className={cn(
                      'me-2 h-4 w-4 shrink-0',
                      value === tz ? 'opacity-100' : 'opacity-0'
                    )}
                  />
                  {/* A sea zone is its offset, so that is its whole name. */}
                  <span className='truncate'>{zoneCity(tz)}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
