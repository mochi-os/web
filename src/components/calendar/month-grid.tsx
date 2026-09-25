// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: Apache-2.0

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { useLingui } from '@lingui/react/macro'
import { plural } from '@lingui/core/macro'
import { Copy, Repeat, Repeat2 } from 'lucide-react'
import { cn } from '../../lib/utils'
import { useFormat } from '../../hooks/use-format'
import {
  addDays,
  barRows,
  coveredDays,
  daysBetween,
  monthOf,
  shiftedEvent,
  weekNumber,
  weekRows,
  type Bar,
  type BarPlacement,
} from './layout'
import {
  arm,
  Hold,
  hover,
  PAGE_EDGE,
  swallow,
  target,
  type Point,
} from './gesture'
import { useEventTooltip } from './tooltip'
import { Wheel } from './wheel'
import type { CalendarEvent, DayMove } from './types'

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
  /** A chip dragged onto another day or calendar. */
  onMove: (move: DayMove) => void
  /** The day's own "+N more" opened. */
  onOverflow: (day: string) => void
  /** A day number clicked. */
  onDay: (day: string) => void
  /**
   * The wheel over the grid, or a chip held at its top or bottom edge: 1 for
   * the next range, -1 for the previous.
   */
  onStep?: (direction: number) => void
}

interface Dragging {
  event: CalendarEvent
  /** The day under the pointer. */
  day: string
  /** Where it started, so a drop that never left it writes nothing. */
  from: string
  /** Alt held: a copy lands there and the original stays. */
  copy: boolean
  /** A calendar outside the grid under the pointer, which takes the chip. */
  calendar?: string
  /** Driven by the arrow keys rather than the pointer. */
  keyboard: boolean
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
  const ghost = useRef<HTMLDivElement>(null)
  const [rowHeight, setRowHeight] = useState(120)
  const [wheel] = useState(() => new Wheel())
  const [dragging, setDragging] = useState<Dragging | null>(null)
  const draggingRef = useRef<Dragging | null>(null)
  draggingRef.current = dragging
  const point = useRef<Point>({ x: 0, y: 0, alt: false })
  const touch = useRef(false)
  const edge = useRef(new Hold())
  const arming = useRef<(() => void) | null>(null)
  const refocus = useRef<string | null>(null)

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

  useEffect(
    () => () => {
      arming.current?.()
      hover(null)
    },
    []
  )

  // How many bars and chips a cell can show before it needs "+N more".
  const capacity = Math.max(1, Math.floor((rowHeight - HEADER - 4) / CHIP))

  // The dragged occurrence as it would land on the day under the pointer,
  // laid out like any other so it takes a row of its own, spans every day it
  // covers and wraps across weeks; nothing while it has not left its day or
  // hovers a calendar row.
  const tentative = useMemo(() => {
    if (!dragging || dragging.calendar || dragging.day === dragging.from)
      return null
    const moved = shiftedEvent(
      dragging.event,
      daysBetween(dragging.from, dragging.day),
      format
    )
    return { ...moved, key: `${dragging.event.key}:lifted` }
  }, [dragging, format])
  const laid = useMemo(
    () => (tentative ? [...events, tentative] : events),
    [events, tentative]
  )

  const bars = useMemo(() => {
    const whole = laid.filter(
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
  }, [laid, rows, format])

  // Timed occurrences that begin and end on the same day, by day; the
  // dragged one first, so its cell always shows it.
  const chips = useMemo(() => {
    const out = new Map<string, CalendarEvent[]>()
    for (const event of laid) {
      if (event.allday) continue
      const day = format.zonedDay(new Date(event.start * 1000))
      if (day !== format.zonedDay(new Date((event.finish - 1) * 1000))) continue
      const list = out.get(day)
      if (list) list.push(event)
      else out.set(day, [event])
    }
    for (const list of out.values()) {
      list.sort((a, b) => a.start - b.start)
      const index = list.findIndex((event) => event.key === tentative?.key)
      if (index > 0) list.unshift(...list.splice(index, 1))
    }
    return out
  }, [laid, tentative, format])

  // --- Dragging a chip onto another day ---

  /** The day cell under a point, if any. */
  const dayAt = (x: number, y: number): string | null => {
    if (typeof document.elementFromPoint !== 'function') return null
    const under = document.elementFromPoint(x, y)?.closest('[data-day]')
    return under?.getAttribute('data-day') ?? null
  }

  /** The page a chip resting at the grid's top or bottom wants. */
  const edgeAt = (x: number, y: number) => {
    const bounds = body.current?.getBoundingClientRect()
    if (!bounds) return 0
    if (x < bounds.left || x > bounds.right) return 0
    if (y >= bounds.top - PAGE_EDGE && y < bounds.top + PAGE_EDGE) return -1
    if (y > bounds.bottom - PAGE_EDGE && y <= bounds.bottom + PAGE_EDGE)
      return 1
    return 0
  }

  /** The drag as it stands with the pointer at `at`: the row or day under it. */
  const advance = (current: Dragging | null, at: Point): Dragging | null => {
    if (!current || current.keyboard) return current
    const { x, y, alt } = at
    const outside = target(x, y)
    hover(outside)
    const calendar = outside?.dataset.drop || undefined
    const day = calendar ? null : dayAt(x, y)
    return { ...current, day: day ?? current.day, copy: alt, calendar }
  }

  /**
   * Reads the pointer's place into the drag. The reference is set at once,
   * so a release in the same breath as a move sees where the move went.
   */
  const update = useCallback(() => {
    const next = advance(draggingRef.current, point.current)
    if (next === draggingRef.current) return
    draggingRef.current = next
    setDragging(next)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- advance reads refs only
  }, [])

  const finish = useCallback(() => {
    const current = draggingRef.current
    if (!current) return
    setDragging(null)
    hover(null)
    if (current.keyboard) refocus.current = current.event.key
    if (current.calendar) {
      if (!current.keyboard) swallow()
      onMove({
        key: current.event.key,
        day: current.from,
        copy: current.copy,
        calendar: current.calendar,
      })
      return
    }
    if (current.day === current.from) return
    if (!current.keyboard) swallow()
    onMove({ key: current.event.key, day: current.day, copy: current.copy })
  }, [onMove])

  const cancel = useCallback(() => {
    const current = draggingRef.current
    if (current?.keyboard) refocus.current = current.event.key
    setDragging(null)
    hover(null)
  }, [])

  const live = useRef({ update, finish, cancel, onStep })
  live.current = { update, finish, cancel, onStep }

  const pointing = dragging !== null && !dragging.keyboard
  useEffect(() => {
    if (!pointing) return
    const move = (event: PointerEvent) => {
      point.current = { x: event.clientX, y: event.clientY, alt: event.altKey }
      live.current.update()
    }
    const up = (event: PointerEvent) => {
      point.current = { x: event.clientX, y: event.clientY, alt: event.altKey }
      live.current.update()
      live.current.finish()
    }
    const lost = () => live.current.cancel()
    const key = (event: KeyboardEvent) => {
      if (event.key === 'Escape') live.current.cancel()
      if (event.key === 'Alt') {
        point.current.alt = event.type === 'keydown'
        live.current.update()
      }
    }
    const still = (event: TouchEvent) => event.preventDefault()
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
    window.addEventListener('pointercancel', lost)
    window.addEventListener('keydown', key)
    window.addEventListener('keyup', key)
    if (touch.current)
      document.addEventListener('touchmove', still, { passive: false })
    document.body.style.setProperty('user-select', 'none')
    if (!touch.current) document.body.style.setProperty('cursor', 'grabbing')
    const held = edge.current
    let frame = 0
    const tick = () => {
      const { x, y } = point.current
      const direction = draggingRef.current?.calendar ? 0 : edgeAt(x, y)
      const step = held.step(direction, Date.now())
      if (step) live.current.onStep?.(step)
      frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      window.removeEventListener('pointercancel', lost)
      window.removeEventListener('keydown', key)
      window.removeEventListener('keyup', key)
      document.removeEventListener('touchmove', still)
      document.body.style.removeProperty('user-select')
      document.body.style.removeProperty('cursor')
      cancelAnimationFrame(frame)
      held.reset()
    }
  }, [pointing])

  // A keyboard drag keeps focus on the chip as it moves, and gives it back
  // to the chip when it ends.
  const chipOf = (key: string) => {
    const chips = body.current?.querySelectorAll<HTMLElement>('[data-key]')
    for (const element of chips ?? []) {
      if (element.dataset.key === key) return element
    }
    return null
  }
  useEffect(() => {
    if (dragging?.keyboard) {
      ;(ghost.current ?? chipOf(dragging.event.key))?.focus()
    }
    if (!dragging && refocus.current) {
      const key = refocus.current
      refocus.current = null
      chipOf(key)?.focus()
    }
  }, [dragging])

  const startMove = (
    event: React.PointerEvent,
    item: CalendarEvent,
    day: string
  ) => {
    if (item.readonly) return
    if (event.pointerType === 'mouse' && event.button !== 0) return
    point.current = { x: event.clientX, y: event.clientY, alt: event.altKey }
    touch.current = event.pointerType === 'touch'
    arming.current?.()
    arming.current = arm(event, (moved) => {
      if (moved)
        point.current = {
          x: moved.clientX,
          y: moved.clientY,
          alt: moved.altKey,
        }
      arming.current = null
      const fresh: Dragging = {
        event: item,
        day,
        from: day,
        copy: point.current.alt,
        keyboard: false,
      }
      draggingRef.current = fresh
      setDragging(fresh)
      update()
    })
  }

  /**
   * The arrow keys move a focused chip by a day or a week; Enter drops it
   * and Escape puts it back. The first arrow lifts the chip; until then
   * Enter opens it.
   */
  const keyed = (
    event: React.KeyboardEvent,
    item: CalendarEvent,
    day: string
  ) => {
    const current = draggingRef.current
    const own =
      current && current.keyboard && current.event.key === item.key
        ? current
        : null
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      if (own) finish()
      else onSelect(item.key, event.currentTarget as HTMLElement)
      return
    }
    if (event.key === 'Escape') {
      if (own) {
        event.preventDefault()
        cancel()
      }
      return
    }
    if (!event.key.startsWith('Arrow') || item.readonly) return
    event.preventDefault()
    const rtl =
      typeof document !== 'undefined' && document.documentElement.dir === 'rtl'
    const shift =
      event.key === 'ArrowUp'
        ? -7
        : event.key === 'ArrowDown'
          ? 7
          : event.key === 'ArrowLeft'
            ? rtl
              ? 1
              : -1
            : rtl
              ? -1
              : 1
    const base = own ?? {
      event: item,
      day,
      from: day,
      copy: false,
      keyboard: true,
    }
    const next = addDays(base.day, shift)
    if (!days.includes(next)) onStep?.(shift < 0 ? -1 : 1)
    setDragging({ ...base, day: next })
  }

  const weekdayNames = useMemo(
    () =>
      (rows[0] ?? []).map((day) =>
        format.formatWeekdayShort(new Date(format.timestampAt(day, 720) * 1000))
      ),
    [rows, format]
  )

  const dayName = (day: string) =>
    format.formatLongDate(new Date(format.timestampAt(day, 720) * 1000))

  /** The dragged occurrence, faded where it was while its copy is lifted. */
  const faded = (event: CalendarEvent) =>
    tentative !== null && dragging?.event.key === event.key && !dragging.copy

  const chipContent = (event: CalendarEvent, lifted: boolean) => (
    <>
      <span
        aria-hidden
        className='size-2 shrink-0 rounded-full'
        style={{ backgroundColor: event.colour }}
      />
      <span className='text-muted-foreground shrink-0'>
        {format.formatClock(new Date(event.start * 1000), event.zone?.start)}
      </span>
      {lifted && dragging?.copy ? (
        <Copy className='size-3 shrink-0' aria-label={t`Copy`} />
      ) : (
        <EventMarks event={event} />
      )}
      <span className={cn('truncate', lifted && 'font-medium')}>
        {event.title}
      </span>
    </>
  )

  const chipButton = (event: CalendarEvent, day: string) =>
    dragging && event.key === tentative?.key ? (
      <div
        key={event.key}
        ref={ghost}
        tabIndex={-1}
        data-testid='ghost'
        onKeyDown={(pointer) => keyed(pointer, dragging.event, dragging.from)}
        className='pointer-events-none flex w-full items-center gap-2 overflow-hidden rounded-sm border-s-[3px] px-2 text-start text-sm shadow-md outline-none'
        style={{
          height: `${CHIP - 2}px`,
          backgroundColor: `${event.colour}33`,
          borderInlineStartColor: event.colour,
        }}
      >
        {chipContent(event, true)}
      </div>
    ) : (
      <button
        key={event.key}
        type='button'
        data-key={event.key}
        onPointerDown={(pointer) => {
          pointer.stopPropagation()
          startMove(pointer, event, day)
        }}
        onClick={(pointer) => {
          pointer.stopPropagation()
          onSelect(event.key, pointer.currentTarget)
        }}
        onKeyDown={(pointer) => keyed(pointer, event, day)}
        title={tooltip(event)}
        className={cn(
          'flex w-full items-center gap-2 overflow-hidden rounded-sm px-2 text-start text-sm',
          faded(event) && 'opacity-40',
          event.readonly ? 'cursor-pointer' : 'cursor-grab'
        )}
        style={{ height: `${CHIP - 2}px` }}
      >
        {chipContent(event, false)}
      </button>
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

      <div
        ref={body}
        data-testid='weeks'
        className='flex min-h-0 flex-1 flex-col'
      >
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
                  const landing =
                    dragging && !dragging.calendar && dragging.day === day
                      ? dragging
                      : null
                  return (
                    <div
                      key={day}
                      data-day={day}
                      className={cn(
                        'hover:bg-hover/40 relative min-h-0 cursor-pointer border-s first:border-s-0',
                        outside && 'bg-muted/30',
                        landing && 'bg-primary/10'
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
                          .map((event) => chipButton(event, day))}
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

                {placements.map(({ placement, event }) =>
                  dragging && event.key === tentative?.key ? (
                    <div
                      key={`${placement.key}:${placement.column}`}
                      ref={ghost}
                      tabIndex={-1}
                      data-testid='ghost'
                      onKeyDown={(pointer) =>
                        keyed(pointer, dragging.event, dragging.from)
                      }
                      className={cn(
                        'pointer-events-none absolute z-20 flex items-center gap-2 overflow-hidden px-2 text-start text-sm shadow-md outline-none',
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
                    >
                      {dragging.copy && (
                        <Copy
                          className='size-3 shrink-0'
                          aria-label={t`Copy`}
                        />
                      )}
                      <span className='truncate font-medium'>
                        {event.title}
                      </span>
                    </div>
                  ) : (
                    <button
                      key={placement.key}
                      type='button'
                      data-key={event.key}
                      onPointerDown={(pointer) => {
                        pointer.stopPropagation()
                        startMove(
                          pointer,
                          event,
                          coveredDays(event, format.zonedDay).start
                        )
                      }}
                      onClick={(pointer) => {
                        pointer.stopPropagation()
                        onSelect(event.key, pointer.currentTarget)
                      }}
                      onKeyDown={(pointer) =>
                        keyed(
                          pointer,
                          event,
                          coveredDays(event, format.zonedDay).start
                        )
                      }
                      className={cn(
                        'absolute flex items-center gap-2 overflow-hidden px-2 text-start text-sm',
                        placement.before
                          ? 'rounded-e-sm'
                          : 'rounded-sm border-s-[3px]',
                        faded(event) && 'opacity-40',
                        event.readonly ? 'cursor-pointer' : 'cursor-grab'
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
                  )
                )}
              </div>
            </div>
          )
        })}
      </div>
      {dragging && !dragging.calendar && (
        <span className='sr-only' aria-live='polite'>
          {t`Moving to ${dayName(dragging.day)}`}
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
