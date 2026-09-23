// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: Apache-2.0

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useLingui } from '@lingui/react/macro'
import { plural } from '@lingui/core/macro'
import { Repeat, Repeat2 } from 'lucide-react'
import { cn } from '../../lib/utils'
import { useFormat } from '../../hooks/use-format'
import {
  barRows,
  coveredDays,
  monthOf,
  weekNumber,
  weekRows,
  type Bar,
  type BarPlacement,
} from './layout'
import { useEventTooltip } from './tooltip'
import { Wheel } from './wheel'
import type { CalendarEvent } from './types'

const BAR = 28
const CHIP = 28
const HEADER = 28

export interface MonthGridProps {
  /** The days shown; a whole number of weeks. */
  days: string[]
  /** The anchored month, 1 through 12; days outside it are dimmed. */
  month?: number
  events: CalendarEvent[]
  /** Today in the user's own zone. */
  today: string
  /** Draws the ISO week number in each row's gutter. */
  weekNumbers?: boolean
  onSelect: (key: string, anchor: HTMLElement) => void
  /** An empty cell clicked. */
  onCreate: (day: string) => void
  /** A chip dragged onto another day, which keeps its time. */
  onMove: (key: string, day: string) => void
  /** The day's own "+N more" opened. */
  onOverflow: (day: string) => void
  /** A day number clicked. */
  onDay: (day: string) => void
  /** The wheel over the grid: 1 for the next range, -1 for the previous. */
  onStep?: (direction: number) => void
}

export function MonthGrid({
  days,
  month,
  events,
  today,
  weekNumbers,
  onSelect,
  onCreate,
  onMove,
  onOverflow,
  onDay,
  onStep,
}: MonthGridProps) {
  const { t } = useLingui()
  const format = useFormat()
  const tooltip = useEventTooltip()
  const body = useRef<HTMLDivElement>(null)
  const [rowHeight, setRowHeight] = useState(120)
  const [wheel] = useState(() => new Wheel())
  // `from` is where the chip started, so a click that never left its own cell
  // writes nothing; a drag ends in a click event, which `dragged` swallows.
  const [dragging, setDragging] = useState<{
    key: string
    day: string
    from: string
  } | null>(null)
  const dragged = useRef(false)

  const rows = useMemo(
    () => weekRows(days[0] ?? today, days.length),
    [days, today]
  )

  useLayoutEffect(() => {
    const element = body.current
    if (!element) return
    const measure = () =>
      setRowHeight(element.clientHeight / Math.max(1, rows.length))
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(element)
    return () => observer.disconnect()
  }, [rows.length])

  // How many bars and chips a cell can show before it needs "+N more".
  const capacity = Math.max(1, Math.floor((rowHeight - HEADER - 4) / CHIP))

  const bars = useMemo(() => {
    const whole = events.filter(
      (event) =>
        event.allday ||
        format.zonedDay(new Date(event.start * 1000)) !==
          format.zonedDay(new Date((event.finish - 1) * 1000))
    )
    const source: Bar[] = whole.map((event) => ({
      key: event.key,
      ...coveredDays(event, format.zonedDay),
    }))
    const byKey = new Map(whole.map((event) => [event.key, event]))
    return rows.map((week) => {
      const placed: { placement: BarPlacement; event: CalendarEvent }[] = []
      for (const placement of barRows(week, source)) {
        const event = byKey.get(placement.key)
        if (event) placed.push({ placement, event })
      }
      return placed
    })
  }, [events, rows, format])

  // Timed occurrences that begin and end on the same day, by day.
  const chips = useMemo(() => {
    const out = new Map<string, CalendarEvent[]>()
    for (const event of events) {
      if (event.allday) continue
      const day = format.zonedDay(new Date(event.start * 1000))
      if (day !== format.zonedDay(new Date((event.finish - 1) * 1000))) continue
      const list = out.get(day)
      if (list) list.push(event)
      else out.set(day, [event])
    }
    for (const list of out.values()) list.sort((a, b) => a.start - b.start)
    return out
  }, [events, format])

  // --- Dragging a chip onto another day ---

  useEffect(() => {
    if (!dragging) return
    const move = (event: PointerEvent) => {
      const under = document
        .elementFromPoint(event.clientX, event.clientY)
        ?.closest('[data-day]')
      const day = under?.getAttribute('data-day')
      if (day)
        setDragging((current) => (current ? { ...current, day } : current))
    }
    const up = () => {
      setDragging((current) => {
        if (current && current.day !== current.from) {
          dragged.current = true
          onMove(current.key, current.day)
        }
        return null
      })
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
    window.addEventListener('pointercancel', up)
    return () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      window.removeEventListener('pointercancel', up)
    }
  }, [dragging, onMove])

  const weekdayNames = useMemo(
    () =>
      (rows[0] ?? []).map((day) =>
        format.formatWeekdayShort(new Date(format.timestampAt(day, 720) * 1000))
      ),
    [rows, format]
  )

  return (
    <div
      className='flex h-full min-h-0 flex-col'
      onWheel={(event) => {
        const direction = wheel.step(event)
        if (direction) onStep?.(direction)
      }}
    >
      <div className='flex border-b'>
        {weekNumbers && <div className='w-8 shrink-0' />}
        <div className='grid flex-1 grid-cols-7'>
          {weekdayNames.map((name, index) => (
            <div
              key={index}
              className='text-muted-foreground py-1 text-center text-xs'
            >
              {name}
            </div>
          ))}
        </div>
      </div>

      <div ref={body} className='flex min-h-0 flex-1 flex-col'>
        {rows.map((week, rowIndex) => {
          const placements = bars[rowIndex] ?? []
          const barCount = placements.reduce(
            (most, item) => Math.max(most, item.placement.row + 1),
            0
          )
          return (
            <div key={week[0]} className='flex min-h-0 flex-1 border-b'>
              {weekNumbers && (
                <div className='text-muted-foreground w-8 shrink-0 pt-1 text-center text-[0.6875rem]'>
                  {weekNumber(week[0])}
                </div>
              )}
              <div className='relative grid flex-1 grid-cols-7'>
                {week.map((day) => {
                  const outside = month !== undefined && monthOf(day) !== month
                  const list = chips.get(day) ?? []
                  const room = Math.max(0, capacity - barCount)
                  const shown =
                    list.length > room ? Math.max(0, room - 1) : room
                  const hidden = list.length - Math.min(list.length, shown)
                  return (
                    <div
                      key={day}
                      data-day={day}
                      className={cn(
                        'hover:bg-hover/40 relative min-h-0 cursor-pointer border-s first:border-s-0',
                        outside && 'bg-muted/30'
                      )}
                      onClick={(pointer) => {
                        if (pointer.target === pointer.currentTarget)
                          onCreate(day)
                      }}
                    >
                      <div
                        className={cn(
                          'flex justify-end px-1 py-0.5',
                          day === today && 'bg-primary text-primary-foreground'
                        )}
                      >
                        <button
                          type='button'
                          onClick={() => onDay(day)}
                          className={cn(
                            'hover:bg-hover rounded-full px-1.5 text-sm',
                            outside && 'text-muted-foreground',
                            day === today &&
                              'text-primary-foreground hover:bg-primary-foreground/20 font-semibold'
                          )}
                        >
                          {format.formatDayNumber(
                            new Date(format.timestampAt(day, 720) * 1000)
                          )}
                        </button>
                      </div>
                      <div
                        className='absolute inset-x-0.5'
                        style={{ top: `${HEADER + barCount * BAR}px` }}
                      >
                        {list
                          .slice(0, Math.min(list.length, shown))
                          .map((event) => (
                            <button
                              key={event.key}
                              type='button'
                              onPointerDown={() => {
                                if (!event.readonly)
                                  setDragging({
                                    key: event.key,
                                    day,
                                    from: day,
                                  })
                              }}
                              onClick={(pointer) => {
                                pointer.stopPropagation()
                                if (dragged.current) {
                                  dragged.current = false
                                  return
                                }
                                onSelect(event.key, pointer.currentTarget)
                              }}
                              title={tooltip(event)}
                              className='flex w-full items-center gap-2 overflow-hidden rounded-sm px-2 text-start text-sm'
                              style={{ height: `${CHIP - 2}px` }}
                            >
                              <span
                                aria-hidden
                                className='size-2 shrink-0 rounded-full'
                                style={{ backgroundColor: event.colour }}
                              />
                              <span className='text-muted-foreground shrink-0'>
                                {format.formatClock(
                                  new Date(event.start * 1000),
                                  event.zone?.start
                                )}
                              </span>
                              <EventMarks event={event} />
                              <span className='truncate'>{event.title}</span>
                            </button>
                          ))}
                        {hidden > 0 && (
                          <button
                            type='button'
                            onClick={(pointer) => {
                              pointer.stopPropagation()
                              onOverflow(day)
                            }}
                            className='text-muted-foreground hover:text-foreground w-full px-2 text-start text-sm'
                            style={{ height: `${CHIP - 2}px` }}
                          >
                            {plural(hidden, {
                              one: '+# more',
                              other: '+# more',
                            })}
                          </button>
                        )}
                      </div>
                    </div>
                  )
                })}

                {placements.map(({ placement, event }) => (
                  <button
                    key={placement.key}
                    type='button'
                    onPointerDown={() => {
                      if (event.readonly) return
                      const day = coveredDays(event, format.zonedDay).start
                      setDragging({ key: event.key, day, from: day })
                    }}
                    onClick={(pointer) => {
                      pointer.stopPropagation()
                      if (dragged.current) {
                        dragged.current = false
                        return
                      }
                      onSelect(event.key, pointer.currentTarget)
                    }}
                    className={cn(
                      'absolute flex items-center gap-2 overflow-hidden px-2 text-start text-sm',
                      placement.before
                        ? 'rounded-e-sm'
                        : 'rounded-sm border-s-[3px]'
                    )}
                    style={{
                      insetInlineStart: `calc(${(placement.column / 7) * 100}% + 2px)`,
                      width: `calc(${(placement.span / 7) * 100}% - 4px)`,
                      top: `${HEADER + placement.row * BAR}px`,
                      height: `${BAR - 2}px`,
                      backgroundColor: `${event.colour}33`,
                      borderInlineStartColor: event.colour,
                    }}
                    title={tooltip(event)}
                  >
                    <EventMarks event={event} />
                    <span className='truncate'>{event.title}</span>
                  </button>
                ))}
              </div>
            </div>
          )
        })}
      </div>
      {dragging && (
        <span className='sr-only' aria-live='polite'>
          {t`Moving to ${dragging.day}`}
        </span>
      )}
    </div>
  )
}

function EventMarks({ event }: { event: CalendarEvent }) {
  const { t } = useLingui()
  if (event.exception) {
    return (
      <Repeat2
        className='size-3 shrink-0 opacity-70'
        aria-label={t`Changed occurrence`}
      />
    )
  }
  if (event.recurring) {
    return (
      <Repeat className='size-3 shrink-0 opacity-70' aria-label={t`Repeats`} />
    )
  }
  return null
}
