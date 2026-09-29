// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: Apache-2.0

import { useEffect, useRef, useState } from 'react'
import { useLingui } from '@lingui/react/macro'
import { ChevronDown, Clock } from 'lucide-react'
import { cn } from '../../lib/utils'
import { dayPeriods, formatClock, parseClock } from '../../lib/locale-format'
import { useLocale } from '../../context/locale-provider'
import { Button } from './button'
import { Input } from './input'
import { Popover, PopoverContent, PopoverTrigger } from './popover'

export interface TimePickerProps {
  id?: string
  /** The time of day, in minutes since midnight. */
  value: number
  onChange: (minutes: number) => void
  disabled?: boolean
  className?: string
  'aria-label'?: string
}

// A time of day on a fixed date, read in UTC, so it formats as the clock
// reading it is whatever the user's zone.
const reading = (minutes: number) =>
  new Date(Date.UTC(2000, 0, 1, Math.floor(minutes / 60), minutes % 60))

/**
 * Moves focus among a grid's buttons with the arrow keys, a row being
 * `columns` wide.
 */
function roam(event: React.KeyboardEvent<HTMLDivElement>, columns: number) {
  const steps: Record<string, number> = {
    ArrowLeft: -1,
    ArrowRight: 1,
    ArrowUp: -columns,
    ArrowDown: columns,
  }
  const step = steps[event.key]
  if (step === undefined) return
  const buttons = Array.from(event.currentTarget.querySelectorAll('button'))
  const at = buttons.indexOf(document.activeElement as HTMLButtonElement)
  const next = buttons[at + step]
  if (at < 0 || !next) return
  event.preventDefault()
  next.focus()
}

/**
 * A time of day typed in the user's own clock, or picked from a grid opened
 * from the clock icon at the end of the field: every hour at once, then the
 * minutes in five-minute steps, every minute a click on the caret further on. An hour
 * keeps the minutes and leaves the grid open; a minute closes it. Typed text
 * is read when the field is left, since an hour typed on its way to a longer
 * time would otherwise move the event on every keystroke.
 */
export function TimePicker({
  id,
  value,
  onChange,
  disabled,
  className,
  'aria-label': label,
}: TimePickerProps) {
  const { t } = useLingui()
  const { timeFormat } = useLocale().locale
  const show = (minutes: number) =>
    formatClock(reading(minutes), timeFormat, 'UTC')

  const [text, setText] = useState(() => show(value))
  const [invalid, setInvalid] = useState(false)
  const [open, setOpen] = useState(false)
  const [every, setEvery] = useState(false)
  const focused = useRef(false)

  // Follow the value when it changes underneath, but not while it is being
  // typed, so an edit is not yanked away.
  useEffect(() => {
    if (focused.current) return
    setText(show(value))
    setInvalid(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, timeFormat])

  const settle = () => {
    focused.current = false
    const minutes = parseClock(text)
    if (minutes === null) {
      setInvalid(true)
      return
    }
    setInvalid(false)
    setText(show(minutes))
    if (minutes !== value) onChange(minutes)
  }

  const hour = Math.floor(value / 60)
  const minute = value % 60
  const choose = (minutes: number) => {
    setText(show(minutes))
    setInvalid(false)
    if (minutes !== value) onChange(minutes)
  }

  const twelve = timeFormat === '12h'
  const periods = twelve ? dayPeriods() : null
  // The hours in the rows they are read in: one run of 24 on a 24-hour
  // clock, a morning and an afternoon of twelve on a 12-hour one.
  const rows: { label: string; hours: number[] }[] = periods
    ? [
        { label: periods.am, hours: [...Array(12).keys()] },
        { label: periods.pm, hours: [...Array(12).keys()].map((h) => h + 12) },
      ]
    : [{ label: '', hours: [...Array(24).keys()] }]
  const minutes = every
    ? [...Array(60).keys()]
    : [...Array(12).keys()].map((m) => m * 5)

  const cell = (selected: boolean) =>
    cn(
      'h-7 rounded-md text-sm tabular-nums',
      selected ? 'bg-primary text-primary-foreground' : 'hover:bg-hover'
    )

  return (
    <div className={cn('relative', className)}>
      <Input
        id={id}
        value={text}
        disabled={disabled}
        aria-label={label}
        aria-invalid={invalid || undefined}
        autoComplete='off'
        className='pe-9'
        onFocus={() => {
          focused.current = true
        }}
        onBlur={settle}
        onKeyDown={(key) => {
          if (key.key === 'Enter') settle()
        }}
        onChange={(input) => setText(input.target.value)}
      />
      <Popover
        open={open}
        onOpenChange={(next) => {
          // A minute off the five-minute steps opens on every minute.
          if (next) setEvery(value % 5 !== 0)
          setOpen(next)
        }}
      >
        <PopoverTrigger asChild>
          <Button
            type='button'
            variant='ghost'
            size='icon'
            disabled={disabled}
            aria-label={t`Choose a time`}
            className='absolute end-1 top-1/2 size-7 -translate-y-1/2'
          >
            <Clock className='size-4' />
          </Button>
        </PopoverTrigger>
        <PopoverContent align='end' className='w-72 space-y-2 p-2'>
          {rows.map((row) => (
            <div key={row.label} className='space-y-1'>
              {row.label && (
                <div className='text-muted-foreground px-1 text-xs'>
                  {row.label}
                </div>
              )}
              <div
                className='grid grid-cols-6 gap-1'
                onKeyDown={(key) => roam(key, 6)}
              >
                {row.hours.map((h) => (
                  <button
                    key={h}
                    type='button'
                    data-hour={h}
                    aria-label={show(h * 60 + minute)}
                    aria-pressed={h === hour}
                    className={cell(h === hour)}
                    onClick={() => choose(h * 60 + minute)}
                  >
                    {twelve ? h % 12 || 12 : String(h).padStart(2, '0')}
                  </button>
                ))}
              </div>
            </div>
          ))}
          <div className='border-t pt-2'>
            <div
              className={cn(
                'grid gap-1',
                every ? 'grid-cols-10' : 'grid-cols-6'
              )}
              onKeyDown={(key) => roam(key, every ? 10 : 6)}
            >
              {minutes.map((m) => (
                <button
                  key={m}
                  type='button'
                  data-minute={m}
                  aria-label={show(hour * 60 + m)}
                  aria-pressed={m === minute}
                  className={cn(cell(m === minute), every && 'text-xs')}
                  onClick={() => {
                    choose(hour * 60 + m)
                    setOpen(false)
                  }}
                >
                  {String(m).padStart(2, '0')}
                </button>
              ))}
            </div>
            {/* A caret opens every minute and closes them again. */}
            <div className='mt-1 flex justify-center'>
              <Button
                type='button'
                variant='ghost'
                size='icon'
                className='h-6 w-10'
                aria-label={t`Every minute`}
                aria-expanded={every}
                onClick={() => setEvery(!every)}
              >
                <ChevronDown
                  className={cn(
                    'size-4 transition-transform',
                    every && 'rotate-180'
                  )}
                />
              </Button>
            </div>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  )
}
