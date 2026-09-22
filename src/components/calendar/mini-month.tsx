// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: Apache-2.0

import { useMemo, useState } from 'react'
import { cn } from '../../lib/utils'
import { useFormat } from '../../hooks/use-format'
import { DateHeader } from './date-header'
import {
  addMonths,
  dayList,
  daysBetween,
  monthOf,
  monthsBetween,
  startOfMonth,
  startOfWeek,
  weekNumber,
  yearOf,
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

/** A month at a glance: click a day to jump, the header to change month or year. */
export function MiniMonth({
  selected,
  today,
  highlight,
  weekNumbers = true,
  onSelect,
  className,
}: MiniMonthProps) {
  const format = useFormat()
  // The month shown follows the selection until the header moves it; picking
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
      <DateHeader
        month={month}
        year={yearOf(anchor)}
        onChange={(year, picked) =>
          setOffset(
            monthsBetween(
              startOfMonth(selected),
              `${year}-${picked < 10 ? '0' : ''}${picked}-01`
            )
          )
        }
      />

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
              .formatWeekdayShort(new Date(format.timestampAt(day, 720) * 1000))
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
          day === today &&
            'bg-primary text-primary-foreground hover:bg-primary/90 font-semibold'
        )}
      >
        {format.formatDayNumber(new Date(format.timestampAt(day, 720) * 1000))}
      </button>
    </>
  )
}
