// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: Apache-2.0

import { useEffect, useRef, useState } from 'react'
import { useLingui } from '@lingui/react/macro'
import { CalendarDays } from 'lucide-react'
import { cn } from '../../lib/utils'
import { parseDate } from '../../lib/locale-format'
import { useFormat } from '../../hooks/use-format'
import { useLocale } from '../../context/locale-provider'
import { Button } from './button'
import { Input } from './input'
import { Popover, PopoverContent, PopoverTrigger } from './popover'
import { MiniMonth } from '../calendar/mini-month'

export interface DatePickerProps {
  id?: string
  /** The chosen day as YYYY-MM-DD, or empty. */
  value: string
  /** A day, or empty when the field is cleared. Never a half-typed date. */
  onChange: (day: string) => void
  /** Whether the text left in the field is not a day, reported when the field settles. */
  onInvalid?: (invalid: boolean) => void
  disabled?: boolean
  className?: string
  'aria-label'?: string
}

/**
 * A day typed in the user's own date format, or picked from a month grid
 * whose header steps months and years on their own, opened from the calendar
 * icon at the end of the field. The text is parsed as it
 * is typed and a complete day is reported at once; text that is not a day is
 * marked when the field is left, and the value stands until it is.
 */
export function DatePicker({
  id,
  value,
  onChange,
  onInvalid,
  disabled,
  className,
  'aria-label': label,
}: DatePickerProps) {
  const { t } = useLingui()
  const format = useFormat()
  const { dateFormat } = useLocale().locale
  const show = (day: string) =>
    day ? format.formatDate(new Date(format.timestampAt(day, 720) * 1000)) : ''

  const [text, setText] = useState(() => show(value))
  const [invalid, setInvalid] = useState(false)
  const [open, setOpen] = useState(false)
  const focused = useRef(false)

  // Follow the value when it changes underneath, but not while it is being
  // typed, so an edit is not yanked away.
  useEffect(() => {
    if (focused.current) return
    setText(show(value))
    setInvalid(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, format])

  const change = (next: string) => {
    setText(next)
    if (!next.trim()) {
      setInvalid(false)
      onInvalid?.(false)
      if (value) onChange('')
      return
    }
    const day = parseDate(next, dateFormat)
    if (day) {
      setInvalid(false)
      onInvalid?.(false)
      if (day !== value) onChange(day)
    }
  }

  const settle = () => {
    focused.current = false
    if (text.trim() && !parseDate(text, dateFormat)) {
      setInvalid(true)
      onInvalid?.(true)
      return
    }
    setInvalid(false)
    onInvalid?.(false)
    setText(show(value))
  }

  const pick = (day: string) => {
    setOpen(false)
    if (day !== value) onChange(day)
    else setText(show(day))
  }

  const today = format.zonedDay(new Date())

  return (
    <div className={cn('relative', className)}>
      <Input
        id={id}
        value={text}
        disabled={disabled}
        placeholder={dateFormat}
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
        onChange={(input) => change(input.target.value)}
      />
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type='button'
            variant='ghost'
            size='icon'
            disabled={disabled}
            aria-label={t`Choose a date`}
            className='absolute end-1 top-1/2 size-7 -translate-y-1/2'
          >
            <CalendarDays className='size-4' />
          </Button>
        </PopoverTrigger>
        <PopoverContent align='end' className='w-64 p-2'>
          <MiniMonth
            selected={value || today}
            today={today}
            weekNumbers={false}
            onSelect={pick}
          />
        </PopoverContent>
      </Popover>
    </div>
  )
}
