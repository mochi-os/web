// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: Apache-2.0

import { useMemo, useState } from 'react'
import { useLingui } from '@lingui/react/macro'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { cn } from '../../lib/utils'
import { useFormat } from '../../hooks/use-format'
import { Button } from '../ui/button'
import {
  addMonths,
  dayList,
  daysBetween,
  monthOf,
  startOfMonth,
  startOfWeek,
  weekNumber,
} from './layout'

export interface MiniMonthProps {
  /** The day the main view is showing; the mini month opens on its month. */
  selected: string
  /** Today in the user's own zone. */
  today: string
  /** The span the main view covers, highlighted across the grid. */
  highlight?: { from: string; days: number }
  /** Draws the ISO week number in each row's gutter. */
  weekNumbers?: boolean
  onSelect: (day: string) => void
  className?: string
}

/** A month at a glance: click a day to jump, chevrons to change month. */
export function MiniMonth({
  selected,
  today,
  highlight,
  weekNumbers = true,
  onSelect,
  className,
}: MiniMonthProps) {
  const { t } = useLingui()
  const format = useFormat()
  // The month shown follows the selection until the chevrons move it; picking
  // a day then puts the two back in step.
  const [offset, setOffset] = useState(0)
  const anchor = addMonths(startOfMonth(selected), offset)
  const month = monthOf(anchor)

  const days = useMemo(
    () => dayList(startOfWeek(anchor, format.weekStartsOn), 42),
    [anchor, format.weekStartsOn]
  )

  const covered = (day: string) =>
    highlight !== undefined &&
    daysBetween(highlight.from, day) >= 0 &&
    daysBetween(highlight.from, day) < highlight.days

  return (
    <div className={cn('px-1', className)}>
      <div className='flex items-center justify-between gap-1'>
        <Button
          variant='ghost'
          size='icon'
          className='size-6'
          aria-label={t`Previous month`}
          onClick={() => setOffset((value) => value - 1)}
        >
          <ChevronLeft className='size-4 rtl:rotate-180' />
        </Button>
        <span className='truncate text-xs font-medium'>
          {format.formatMonthYear(
            new Date(format.timestampAt(anchor, 720) * 1000)
          )}
        </span>
        <Button
          variant='ghost'
          size='icon'
          className='size-6'
          aria-label={t`Next month`}
          onClick={() => setOffset((value) => value + 1)}
        >
          <ChevronRight className='size-4 rtl:rotate-180' />
        </Button>
      </div>

      <div
        className={cn(
          'mt-1 grid gap-px text-center text-[0.6875rem]',
          weekNumbers ? 'grid-cols-8' : 'grid-cols-7'
        )}
      >
        {weekNumbers && <span />}
        {days.slice(0, 7).map((day) => (
          <span key={day} className='text-muted-foreground'>
            {format
              .formatWeekdayShort(
                new Date(format.timestampAt(day, 720) * 1000)
              )
              .slice(0, 2)}
          </span>
        ))}
        {days.map((day, index) => (
          <Cell
            key={day}
            day={day}
            index={index}
            month={month}
            today={today}
            covered={covered(day)}
            weekNumbers={weekNumbers}
            onSelect={(picked) => {
              setOffset(0)
              onSelect(picked)
            }}
          />
        ))}
      </div>
    </div>
  )
}

function Cell({
  day,
  index,
  month,
  today,
  covered,
  weekNumbers,
  onSelect,
}: {
  day: string
  index: number
  month: number
  today: string
  covered: boolean
  weekNumbers: boolean
  onSelect: (day: string) => void
}) {
  const format = useFormat()
  return (
    <>
      {weekNumbers && index % 7 === 0 && (
        <span className='text-muted-foreground/70'>{weekNumber(day)}</span>
      )}
      <button
        type='button'
        onClick={() => onSelect(day)}
        className={cn(
          'hover:bg-hover rounded-sm py-0.5',
          monthOf(day) !== month && 'text-muted-foreground/60',
          covered && 'bg-accent',
          day === today && 'text-primary font-semibold'
        )}
      >
        {format.formatDayNumber(new Date(format.timestampAt(day, 720) * 1000))}
      </button>
    </>
  )
}
