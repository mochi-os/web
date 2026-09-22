// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: Apache-2.0

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useLingui } from '@lingui/react/macro'
import { Repeat, Repeat2 } from 'lucide-react'
import { cn } from '../../lib/utils'
import { useFormat } from '../../hooks/use-format'
import {
  addDays,
  barRows,
  dayOfWeek,
  overlapColumns,
  snap,
  type Bar,
  type BarPlacement,
} from './layout'
import { useEventTooltip } from './tooltip'
import type { CalendarEvent, EventMove } from './types'

const HOUR = 80
// The shortest block still shows one line of text; a taller one adds the
// time and place beneath the title.
const LINE = 24
const TWO_LINES = 48
const SNAP = 15
const MINIMUM = 15

export interface TimeGridProps {
  /** The days shown, as YYYY-MM-DD in the user's own zone. */
  days: string[]
  events: CalendarEvent[]
  /** Minutes a new event lasts when the grid is clicked rather than dragged. */
  duration: number
  /** Working hours as whole hours; the rest of the day is shaded. */
  hours: { start: number; finish: number }
  /** Work days, 0 = Sunday through 6 = Saturday. */
  workdays: number[]
  /** Today in the user's own zone. */
  today: string
  /** Opens the occurrence's summary popover. */
  onSelect: (key: string, anchor: HTMLElement) => void
  /** A drag across empty grid, in unix seconds. */
  onCreate: (start: number, finish: number) => void
  /** A block dragged to a new time, or its end dragged. */
  onMove: (move: EventMove) => void
  /** A day header clicked. */
  onDay: (day: string) => void
}

type Drag =
  | {
      mode: 'create'
      day: string
      anchor: number
      start: number
      finish: number
    }
  | {
      mode: 'move'
      key: string
      day: string
      start: number
      length: number
      grab: number
      /** Where it began, so a click that never moved writes nothing. */
      from: { day: string; start: number }
      moved: boolean
    }
  | {
      mode: 'resize'
      key: string
      day: string
      start: number
      finish: number
      from: number
      moved: boolean
    }

export function TimeGrid({
  days,
  events,
  duration,
  hours,
  workdays,
  today,
  onSelect,
  onCreate,
  onMove,
  onDay,
}: TimeGridProps) {
  const { t } = useLingui()
  const format = useFormat()
  const tooltip = useEventTooltip()
  const scroller = useRef<HTMLDivElement>(null)
  const columns = useRef<HTMLDivElement>(null)
  const [drag, setDrag] = useState<Drag | null>(null)
  const [minute, setMinute] = useState(() => Math.floor(Date.now() / 1000))
  // A drag ends in a click event on the block it started from; without this
  // the summary popover opens on top of every move.
  const dragged = useRef(false)

  // The current-time line only has to be right to the minute.
  useEffect(() => {
    const timer = window.setInterval(
      () => setMinute(Math.floor(Date.now() / 1000)),
      30000
    )
    return () => window.clearInterval(timer)
  }, [])

  // Opens on the working day rather than on midnight.
  useEffect(() => {
    // A little above the first working hour, so its label is not clipped.
    if (scroller.current)
      scroller.current.scrollTop = Math.max(0, hours.start * HOUR - 10)
  }, [hours.start])

  const timed = useMemo(() => events.filter((e) => !e.allday), [events])
  const whole = useMemo(() => events.filter((e) => e.allday), [events])

  // Blocks per day, already placed side by side where they overlap. An
  // occurrence crossing midnight draws a block on each day it covers.
  const blocks = useMemo(() => {
    const perDay = new Map<
      string,
      { event: CalendarEvent; start: number; finish: number }[]
    >()
    for (const day of days) perDay.set(day, [])
    for (const event of timed) {
      for (const day of days) {
        const open = format.timestampAt(day, 0)
        const close = format.timestampAt(addDays(day, 1), 0)
        if (event.finish <= open || event.start >= close) continue
        const list = perDay.get(day)
        if (!list) continue
        list.push({
          event,
          start: Math.max(0, (Math.max(event.start, open) - open) / 60),
          finish: Math.min(1440, (Math.min(event.finish, close) - open) / 60),
        })
      }
    }
    const out = new Map<
      string,
      {
        event: CalendarEvent
        start: number
        finish: number
        column: number
        width: number
      }[]
    >()
    for (const [day, list] of perDay) {
      const placements = overlapColumns(
        list.map((item) => ({
          start: item.start,
          // A very short occurrence still needs a clickable block.
          finish: Math.max(item.finish, item.start + MINIMUM),
        }))
      )
      out.set(
        day,
        list.map((item, index) => ({
          ...item,
          column: placements[index].column,
          width: placements[index].columns,
        }))
      )
    }
    return out
  }, [days, timed, format])

  // All-day and multi-day occurrences, stacked into the band above the grid.
  const bars = useMemo(() => {
    const source: Bar[] = whole.map((event) => ({
      key: event.key,
      start: format.zonedDay(new Date(event.start * 1000)),
      // An all-day occurrence finishes at the start of the day after its last,
      // so the last day it covers is one second before its finish.
      finish: format.zonedDay(new Date((event.finish - 1) * 1000)),
    }))
    const byKey = new Map(whole.map((event) => [event.key, event]))
    const out: { placement: BarPlacement; event: CalendarEvent }[] = []
    for (const placement of barRows(days, source)) {
      const event = byKey.get(placement.key)
      if (event) out.push({ placement, event })
    }
    return out
  }, [days, whole, format])

  const bandRows = bars.reduce(
    (most, item) => Math.max(most, item.placement.row + 1),
    0
  )

  // --- Pointer geometry ---

  const pointAt = useCallback(
    (clientX: number, clientY: number) => {
      const element = columns.current
      if (!element) return null
      const rect = element.getBoundingClientRect()
      const rtl =
        typeof document !== 'undefined' &&
        document.documentElement.dir === 'rtl'
      const across = rtl ? rect.right - clientX : clientX - rect.left
      const width = rect.width / Math.max(1, days.length)
      const index = Math.min(
        days.length - 1,
        Math.max(0, Math.floor(across / width))
      )
      const minutes = Math.min(
        1440,
        Math.max(0, ((clientY - rect.top) / HOUR) * 60)
      )
      return { day: days[index], minutes }
    },
    [days]
  )

  const finish = useCallback(() => {
    if (!drag) return
    if (drag.mode === 'create') {
      const from = Math.min(drag.start, drag.finish)
      const to = Math.max(drag.start, drag.finish)
      const start = format.timestampAt(drag.day, from)
      // A click rather than a drag: the default length, as "New event" uses.
      const end =
        to - from < SNAP
          ? start + duration * 60
          : format.timestampAt(drag.day, to)
      onCreate(start, end)
    } else if (!drag.moved) {
      // A click, not a drag: nothing moved, so nothing is written.
      setDrag(null)
      return
    } else if (drag.mode === 'move') {
      dragged.current = true
      const start = format.timestampAt(drag.day, drag.start)
      onMove({ key: drag.key, start, finish: start + drag.length * 60 })
    } else {
      dragged.current = true
      onMove({
        key: drag.key,
        start: format.timestampAt(drag.day, drag.start),
        finish: format.timestampAt(drag.day, drag.finish),
      })
    }
    setDrag(null)
  }, [drag, duration, format, onCreate, onMove])

  useEffect(() => {
    if (!drag) return
    const move = (event: PointerEvent) => {
      const point = pointAt(event.clientX, event.clientY)
      if (!point) return
      setDrag((current) => {
        if (!current) return current
        const minutes = snap(point.minutes, SNAP)
        if (current.mode === 'create') {
          return {
            ...current,
            day: current.day,
            start: current.anchor,
            finish: minutes,
          }
        }
        if (current.mode === 'move') {
          const start = Math.max(
            0,
            Math.min(1440 - current.length, minutes - current.grab)
          )
          return {
            ...current,
            day: point.day,
            start,
            moved:
              current.moved ||
              point.day !== current.from.day ||
              start !== current.from.start,
          }
        }
        const end = Math.max(current.start + MINIMUM, minutes)
        return {
          ...current,
          finish: end,
          moved: current.moved || end !== current.from,
        }
      })
    }
    const up = () => finish()
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
    window.addEventListener('pointercancel', up)
    return () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      window.removeEventListener('pointercancel', up)
    }
  }, [drag, pointAt, finish])

  const startCreate = (event: React.PointerEvent, day: string) => {
    if (event.button !== 0) return
    const point = pointAt(event.clientX, event.clientY)
    if (!point) return
    const minutes = snap(point.minutes, SNAP)
    // The span starts empty, so a click that never drags is told apart from a
    // drag of one step and gets the default event length instead.
    setDrag({
      mode: 'create',
      day,
      anchor: minutes,
      start: minutes,
      finish: minutes,
    })
  }

  const startMove = (
    event: React.PointerEvent,
    item: CalendarEvent,
    day: string,
    start: number,
    length: number
  ) => {
    // Stopped first: a read-only block must not fall through to the grid
    // beneath it and start creating an event.
    event.stopPropagation()
    if (event.button !== 0 || item.readonly) return
    const point = pointAt(event.clientX, event.clientY)
    if (!point) return
    setDrag({
      mode: 'move',
      key: item.key,
      day,
      start,
      length,
      grab: snap(point.minutes, SNAP) - start,
      from: { day, start },
      moved: false,
    })
  }

  const startResize = (
    event: React.PointerEvent,
    item: CalendarEvent,
    day: string,
    start: number,
    end: number
  ) => {
    event.stopPropagation()
    if (event.button !== 0 || item.readonly) return
    setDrag({
      mode: 'resize',
      key: item.key,
      day,
      start,
      finish: end,
      from: end,
      moved: false,
    })
  }

  const nowDay = format.zonedDay(new Date(minute * 1000))
  const nowMinutes = format.zonedMinutes(new Date(minute * 1000))

  const gridTemplate = {
    // eslint-disable-next-line lingui/no-unlocalized-strings -- a CSS grid template, never shown to anyone
    gridTemplateColumns: `repeat(${days.length}, minmax(0, 1fr))`,
  }

  return (
    <div className='flex h-full min-h-0 flex-col'>
      {/* Day headers: the columns' names, which a single column does not
          need since the toolbar's title already says which day it is. */}
      {days.length > 1 && (
        <div className='flex border-b'>
          <div className='w-14 shrink-0' />
          <div className='grid flex-1' style={gridTemplate}>
            {days.map((day) => {
              const date = new Date(format.timestampAt(day, 720) * 1000)
              return (
                <button
                  key={day}
                  type='button'
                  onClick={() => onDay(day)}
                  className={cn(
                    'hover:bg-hover flex flex-col items-center gap-0.5 py-2 text-xs',
                    day === today && 'text-primary font-semibold'
                  )}
                >
                  <span className='text-muted-foreground'>
                    {format.formatWeekdayShort(date)}
                  </span>
                  <span className='text-sm'>
                    {format.formatDayNumber(date)}
                  </span>
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* All-day band */}
      <div className='flex border-b'>
        <div className='text-muted-foreground w-14 shrink-0 px-1 py-1.5 text-xs'>
          {t`All day`}
        </div>
        <div
          className='relative flex-1'
          style={{ minHeight: `${Math.max(1, bandRows) * 28 + 4}px` }}
        >
          <div className='absolute inset-0 grid' style={gridTemplate}>
            {days.map((day) => (
              <div key={day} className='border-s first:border-s-0' />
            ))}
          </div>
          {bars.map(({ placement, event }) => (
            <button
              key={placement.key}
              type='button'
              onClick={(pointer) => onSelect(event.key, pointer.currentTarget)}
              title={tooltip(event)}
              className='absolute flex h-[26px] items-center gap-1.5 overflow-hidden rounded-sm border-s-[3px] px-2 text-start text-sm'
              style={{
                insetInlineStart: `${(placement.column / days.length) * 100}%`,
                width: `calc(${(placement.span / days.length) * 100}% - 2px)`,
                top: `${placement.row * 28 + 2}px`,
                backgroundColor: `${event.colour}33`,
                borderInlineStartColor: event.colour,
              }}
            >
              <EventMarks event={event} />
              <span className='truncate'>{event.title}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Hour grid */}
      <div ref={scroller} className='min-h-0 flex-1 overflow-y-auto'>
        <div className='flex'>
          <div className='w-14 shrink-0'>
            {Array.from({ length: 24 }, (_, hour) => (
              <div
                key={hour}
                className='text-muted-foreground relative text-end text-xs'
                style={{ height: `${HOUR}px` }}
              >
                <span className='absolute end-1 -top-1.5'>
                  {hour > 0
                    ? format.formatHour(
                        new Date(format.timestampAt(days[0], hour * 60) * 1000)
                      )
                    : ''}
                </span>
              </div>
            ))}
          </div>
          <div
            ref={columns}
            className='relative grid flex-1'
            style={gridTemplate}
          >
            {days.map((day) => {
              const working = workdays.includes(dayOfWeek(day))
              return (
                <div
                  key={day}
                  className='relative border-s first:border-s-0'
                  style={{ height: `${24 * HOUR}px` }}
                  onPointerDown={(pointer) => startCreate(pointer, day)}
                >
                  {/* Non-working shading */}
                  {!working ? (
                    <div className='bg-muted/40 pointer-events-none absolute inset-0' />
                  ) : (
                    <>
                      <div
                        className='bg-muted/40 pointer-events-none absolute inset-x-0 top-0'
                        style={{ height: `${hours.start * HOUR}px` }}
                      />
                      <div
                        className='bg-muted/40 pointer-events-none absolute inset-x-0 bottom-0'
                        style={{ height: `${(24 - hours.finish) * HOUR}px` }}
                      />
                    </>
                  )}
                  {Array.from({ length: 24 }, (_, hour) => (
                    <div
                      key={hour}
                      className='pointer-events-none absolute inset-x-0 border-t'
                      style={{ top: `${hour * HOUR}px` }}
                    />
                  ))}

                  {(blocks.get(day) ?? []).map((item) => {
                    const dragging =
                      drag &&
                      drag.mode !== 'create' &&
                      drag.key === item.event.key
                    if (dragging && drag.day !== day) return null
                    const start = dragging ? drag.start : item.start
                    const end = dragging
                      ? drag.mode === 'move'
                        ? drag.start + drag.length
                        : drag.finish
                      : Math.max(item.finish, item.start + MINIMUM)
                    return (
                      <div
                        key={item.event.key}
                        role='button'
                        tabIndex={0}
                        onPointerDown={(pointer) =>
                          startMove(
                            pointer,
                            item.event,
                            day,
                            item.start,
                            Math.max(MINIMUM, item.finish - item.start)
                          )
                        }
                        onClick={(pointer) => {
                          if (dragged.current) {
                            dragged.current = false
                            return
                          }
                          onSelect(item.event.key, pointer.currentTarget)
                        }}
                        onKeyDown={(pointer) => {
                          if (pointer.key === 'Enter' || pointer.key === ' ') {
                            pointer.preventDefault()
                            onSelect(item.event.key, pointer.currentTarget)
                          }
                        }}
                        title={tooltip(item.event)}
                        className={cn(
                          'absolute overflow-hidden rounded-sm border-s-[3px] px-2 py-0.5 text-start text-sm leading-5',
                          dragging ? 'z-20 opacity-80' : 'z-10',
                          item.event.readonly ? 'cursor-pointer' : 'cursor-grab'
                        )}
                        style={{
                          top: `${(start / 60) * HOUR}px`,
                          height: `${Math.max(LINE, ((end - start) / 60) * HOUR - 1)}px`,
                          insetInlineStart: `${(item.column / item.width) * 100}%`,
                          width: `calc(${100 / item.width}% - 2px)`,
                          backgroundColor: `${item.event.colour}33`,
                          borderInlineStartColor: item.event.colour,
                        }}
                      >
                        <div className='flex items-center gap-1'>
                          <EventMarks event={item.event} />
                          <span className='truncate font-medium'>
                            {item.event.title}
                          </span>
                        </div>
                        {((end - start) / 60) * HOUR >= TWO_LINES && (
                          <div className='text-muted-foreground truncate text-xs'>
                            {format.formatClock(
                              new Date(item.event.start * 1000)
                            )}
                            {item.event.location
                              ? ` · ${item.event.location}`
                              : ''}
                          </div>
                        )}
                        {!item.event.readonly && (
                          <div
                            role='presentation'
                            className='absolute inset-x-0 bottom-0 h-2 cursor-ns-resize'
                            onPointerDown={(pointer) =>
                              startResize(
                                pointer,
                                item.event,
                                day,
                                item.start,
                                Math.max(item.finish, item.start + MINIMUM)
                              )
                            }
                          />
                        )}
                      </div>
                    )
                  })}

                  {drag?.mode === 'create' && drag.day === day && (
                    <div
                      className='bg-primary/20 border-primary pointer-events-none absolute inset-x-1 z-20 rounded-sm border-s-[3px]'
                      style={{
                        top: `${(Math.min(drag.start, drag.finish) / 60) * HOUR}px`,
                        height: `${(Math.max(SNAP, Math.abs(drag.finish - drag.start)) / 60) * HOUR}px`,
                      }}
                    />
                  )}

                  {day === nowDay && (
                    <div
                      className='pointer-events-none absolute inset-x-0 z-30 border-t-2 border-red-500'
                      style={{ top: `${(nowMinutes / 60) * HOUR}px` }}
                    >
                      <span className='absolute -top-1 -start-1 size-2 rounded-full bg-red-500' />
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      </div>
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
