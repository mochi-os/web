// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: Apache-2.0

import { useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useLingui } from '@lingui/react/macro'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { cn } from '../../lib/utils'
import { useFormat } from '../../hooks/use-format'
import { Button } from '../ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover'

export interface DateHeaderProps {
  /** The month shown, 1 through 12. */
  month: number
  year: number
  onChange: (year: number, month: number) => void
  className?: string
}

/**
 * A month box and a year box, each with its own chevrons. The month chevrons
 * roll over the year at either end; the year chevrons keep the month. The
 * month name opens the twelve months, the year opens a list that grows in
 * either direction as it is scrolled.
 */
export function DateHeader({
  month,
  year,
  onChange,
  className,
}: DateHeaderProps) {
  const { t } = useLingui()
  const format = useFormat()
  const names = useMemo(
    () =>
      Array.from({ length: 12 }, (_, index) =>
        format.formatMonthName(new Date(2000, index, 15))
      ),
    [format]
  )
  const [months, setMonths] = useState(false)
  const [years, setYears] = useState(false)

  const step = (by: number) => {
    let next = month + by
    let same = year
    if (next < 1) {
      next = 12
      same -= 1
    } else if (next > 12) {
      next = 1
      same += 1
    }
    onChange(same, next)
  }

  return (
    <div className={cn('flex items-center justify-between gap-1', className)}>
      <div className='flex min-w-0 items-center'>
        <Chevron label={t`Previous month`} back onClick={() => step(-1)} />
        <Popover open={months} onOpenChange={setMonths}>
          <PopoverTrigger asChild>
            <Button
              variant='ghost'
              size='sm'
              className='h-6 px-1 text-xs font-medium'
            >
              {/* Every name occupies the same cell, so the box is as wide as
                  the widest month and the chevron beside it never moves. */}
              <span className='grid text-center'>
                {names.map((name, index) => (
                  <span
                    key={name}
                    aria-hidden={index + 1 !== month || undefined}
                    className={cn(
                      'col-start-1 row-start-1',
                      index + 1 !== month && 'invisible'
                    )}
                  >
                    {name}
                  </span>
                ))}
              </span>
            </Button>
          </PopoverTrigger>
          <PopoverContent align='start' className='w-auto p-1'>
            <div
              role='listbox'
              aria-label={t`Month`}
              className='flex flex-col gap-px'
            >
              {names.map((name, index) => (
                <button
                  key={name}
                  type='button'
                  role='option'
                  aria-selected={index + 1 === month}
                  onClick={() => {
                    onChange(year, index + 1)
                    setMonths(false)
                  }}
                  className={cn(
                    'hover:bg-hover rounded-sm px-2 py-1 text-start text-xs',
                    index + 1 === month &&
                      'bg-primary/10 text-primary font-semibold'
                  )}
                >
                  {name}
                </button>
              ))}
            </div>
          </PopoverContent>
        </Popover>
        <Chevron label={t`Next month`} onClick={() => step(1)} />
      </div>
      <div className='flex items-center'>
        <Chevron
          label={t`Previous year`}
          back
          onClick={() => onChange(year - 1, month)}
        />
        {/* Modal, so the list scrolls under a dialog too: a modal dialog
            locks wheel scrolling everywhere but inside its own or a nested
            modal layer, and the picker's popover is portaled outside it. */}
        <Popover open={years} onOpenChange={setYears} modal>
          <PopoverTrigger asChild>
            <Button
              variant='ghost'
              size='sm'
              className='h-6 px-1 text-xs font-medium tabular-nums'
            >
              {String(year)}
            </Button>
          </PopoverTrigger>
          <PopoverContent align='end' className='w-auto p-1'>
            <YearList
              year={year}
              label={t`Year`}
              onSelect={(picked) => {
                onChange(picked, month)
                setYears(false)
              }}
            />
          </PopoverContent>
        </Popover>
        <Chevron
          label={t`Next year`}
          onClick={() => onChange(year + 1, month)}
        />
      </div>
    </div>
  )
}

function Chevron({
  label,
  back,
  onClick,
}: {
  label: string
  back?: boolean
  onClick: () => void
}) {
  const Icon = back ? ChevronLeft : ChevronRight
  return (
    <Button
      variant='ghost'
      size='icon'
      className='size-6 shrink-0'
      aria-label={label}
      onClick={onClick}
    >
      <Icon className='size-4 rtl:rotate-180' />
    </Button>
  )
}

// Years added at either end each time the list is scrolled there, and the
// height of one row, which the scroll arithmetic relies on.
const YEARS = 40
const ROW = 28

/** Years around the shown one, more of them whichever way the list is scrolled. */
function YearList({
  year,
  label,
  onSelect,
}: {
  year: number
  label: string
  onSelect: (year: number) => void
}) {
  const [first, setFirst] = useState(year - YEARS)
  const [last, setLast] = useState(year + YEARS)
  const box = useRef<HTMLDivElement>(null)
  // The scroll height before years were added above, so the reader's place
  // is kept when they land.
  const held = useRef<number | null>(null)

  useLayoutEffect(() => {
    const element = box.current
    if (!element) return
    if (held.current !== null) {
      element.scrollTop += element.scrollHeight - held.current
      held.current = null
    }
  }, [first])

  useLayoutEffect(() => {
    const element = box.current
    if (element) {
      element.scrollTop =
        (year - first) * ROW - element.clientHeight / 2 + ROW / 2
    }
    // Centre on the shown year once, when the list opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const scrolled = () => {
    const element = box.current
    if (!element) return
    if (element.scrollTop < ROW * 4) {
      held.current = element.scrollHeight
      setFirst((value) => value - YEARS)
    } else if (
      element.scrollTop + element.clientHeight >
      element.scrollHeight - ROW * 4
    ) {
      setLast((value) => value + YEARS)
    }
  }

  const list: number[] = []
  for (let value = first; value <= last; value++) list.push(value)

  return (
    <div
      ref={box}
      role='listbox'
      aria-label={label}
      onScroll={scrolled}
      className='h-56 w-24 overflow-y-auto'
    >
      {list.map((value) => (
        <button
          key={value}
          type='button'
          role='option'
          aria-selected={value === year}
          onClick={() => onSelect(value)}
          style={{ height: ROW }}
          className={cn(
            'hover:bg-hover block w-full rounded-sm px-2 text-xs tabular-nums',
            value === year && 'bg-primary/10 text-primary font-semibold'
          )}
        >
          {String(value)}
        </button>
      ))}
    </div>
  )
}
