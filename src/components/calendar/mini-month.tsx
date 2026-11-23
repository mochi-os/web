// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: Apache-2.0

import { useMemo, useState } from 'react'
import { cn } from '../../lib/utils'
import { useFormat } from '../../hooks/use-format'
import { DateHeader } from './date-header'
import {
  addDays,
  addMonths,
  dayList,
  monthOf,
  monthsBetween,
  startOfMonth,
  startOfWeek,
  weekNumber,
  yearOf,
} from './layout'
import { Wheel } from './wheel'

export interface MiniMonthProps {
  /** The day the main view is showing; the mini month opens on its month. */
  selected: string
  /**
   * The day drawn as chosen: the one the main view is on, or a date field's
   * value. None when nothing is chosen, as for an empty field.
   */
  chosen?: string
  /** Today in the user's own zone. */
  today: string
  /** Draws the ISO week number in each row's gutter. */
  weekNumbers?: boolean
  onSelect: (day: string) => void
  className?: string
}

/** A month at a glance: click a day to jump, the header to change month or year. */
export function MiniMonth({
  selected,
  chosen,
  today,
  weekNumbers = true,
  onSelect,
  className,
}: MiniMonthProps) {
  const format = useFormat()
  // The month shown follows the selection until the header moves it; picking
  // a day then puts the two back in step.
  const [offset, setOffset] = useState(0)
  const [wheel] = useState(() => new Wheel())
  const anchor = addMonths(startOfMonth(selected), offset)
  const month = monthOf(anchor)

  const days = useMemo(
    () => dayList(startOfWeek(anchor, format.weekStartsOn), 42),
    [anchor, format.weekStartsOn]
  )

  return (
    <div
      className={cn('px-1', className)}
      onWheel={(event) => {
        // React delivers a wheel inside the month and year menus here too,
        // through their portals: scrolling a menu's list must not turn the
        // month beneath it.
        if (!event.currentTarget.contains(event.target as Node)) return
        const direction = wheel.step(event)
        if (direction) setOffset((current) => current + direction)
      }}
    >
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

      {/* Week numbers take a narrow gutter of their own: a cell this small
          has no corner to spare for them, but a day's width is too much. */}
      <div
        className={cn(
          'mt-1 grid gap-px text-center text-[0.6875rem]',
          weekNumbers
            ? 'grid-cols-[1rem_repeat(7,minmax(0,1fr))]'
            : 'grid-cols-7'
        )}
      >
        {weekNumbers && <span />}
        {/* Each heading in the language's own narrow form, never a cut
            name, with the whole name for a reader and on hover. */}
        {days.slice(0, 7).map((day) => {
          const noon = new Date(format.timestampAt(day, 720) * 1000)
          const name = format.formatWeekday(noon)
          return (
            <span
              key={day}
              title={name}
              className='text-muted-foreground min-w-0 truncate'
            >
              <span aria-hidden='true'>{format.formatWeekdayNarrow(noon)}</span>
              <span className='sr-only'>{name}</span>
            </span>
          )
        })}
        {days.map((day, index) => (
          <Cell
            key={day}
            day={day}
            index={index}
            month={month}
            chosen={chosen}
            today={today}
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
  chosen,
  today,
  weekNumbers,
  onSelect,
}: {
  day: string
  index: number
  month: number
  chosen?: string
  today: string
  weekNumbers: boolean
  onSelect: (day: string) => void
}) {
  const format = useFormat()
  const noon = new Date(format.timestampAt(day, 720) * 1000)
  const picked = day === chosen
  return (
    <>
      {/* The row's middle day is in the ISO week most of it is in. */}
      {weekNumbers && index % 7 === 0 && (
        <span data-testid='week-number' className='text-muted-foreground/70'>
          {weekNumber(addDays(day, 3))}
        </span>
      )}
      {/* The chosen day is drawn as the time picker draws its chosen hour;
          today keeps its colour only while it is not the one chosen. */}
      <button
        type='button'
        onClick={() => onSelect(day)}
        aria-label={format.formatLongDate(noon)}
        aria-pressed={chosen === undefined ? undefined : picked}
        aria-current={day === today ? 'date' : undefined}
        className={cn(
          'rounded-sm py-0.5',
          picked
            ? 'bg-primary text-primary-foreground'
            : [
                'hover:bg-hover',
                monthOf(day) !== month && 'text-muted-foreground/60',
                day === today && 'text-primary',
              ],
          day === today && 'font-semibold'
        )}
      >
        {format.formatDayNumber(noon)}
      </button>
    </>
  )
}
