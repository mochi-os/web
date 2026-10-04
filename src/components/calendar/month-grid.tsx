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
import { Plural, useLingui } from '@lingui/react/macro'
import { Bell, Copy, Repeat, Repeat2 } from 'lucide-react'
import { cn, naturalCompare } from '../../lib/utils'
import { useFormat } from '../../hooks/use-format'
import {
  addDays,
  coveredDays,
  daysBetween,
  finished,
  monthOf,
  shiftedEvent,
  weekNumber,
  weekRows,
} from './layout'
import {
  arm,
  Hold,
  hover,
  PAGE_EDGE,
  runEnds,
  swallow,
  target,
  type Choosing,
  type Point,
} from './gesture'
import { EventDot } from './event-dot'
import { EventTitle } from './event-title'
import { useEventTooltip } from './tooltip'
import { Wheel } from './wheel'
import type { CalendarEvent, DayMove } from './types'

// An all-day or multi-day event's one line.
const BAR = 28
// A timed event's two lines: its title, then its time and marks.
const CHIP = 40
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
  /**
   * Where a day's all-day and multi-day events go among its timed ones:
   * above them, the default, or below.
   */
  allday?: 'first' | 'last'
  /** The occurrence whose summary or editor is open, drawn tinted. */
  selected?: string
  onSelect: (key: string, anchor: HTMLElement) => void
  /** An empty cell clicked. */
  onCreate: (day: string) => void
  /**
   * A drag across empty cells, with the first and last day it covers. Without
   * it a drag does nothing and only a click creates.
   */
  onCreateRange?: (first: string, last: string) => void
  /** A chip dragged onto another day or calendar. */
  onMove: (move: DayMove) => void
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
  /**
   * The first day of the occurrence, which moves by as many days as the
   * pointer does; a multi-day one may be taken by any of its days.
   */
  start: string
  /** Alt held: a copy lands there and the original stays. */
  copy: boolean
  /** A calendar outside the grid under the pointer, which takes the chip. */
  calendar?: string
  /** Driven by the arrow keys rather than the pointer. */
  keyboard: boolean
}

/** The day cell under a point, if any. */
function dayAt(x: number, y: number): string | null {
  if (typeof document.elementFromPoint !== 'function') return null
  const under = document.elementFromPoint(x, y)?.closest('[data-day]')
  return under?.getAttribute('data-day') ?? null
}

export function MonthGrid({
  days,
  month,
  events,
  today,
  weekNumbers,
  allday = 'first',
  selected,
  onSelect,
  onCreate,
  onCreateRange,
  onMove,
  onDay,
  onStep,
}: MonthGridProps) {
  const { t } = useLingui()
  const format = useFormat()
  const tooltip = useEventTooltip()
  const body = useRef<HTMLDivElement>(null)
  const ghost = useRef<HTMLDivElement>(null)
  const [rowHeight, setRowHeight] = useState(120)
  const [overflow, setOverflow] = useState<Map<string, number>>(new Map())
  const [wheel] = useState(() => new Wheel())
  const [dragging, setDragging] = useState<Dragging | null>(null)
  const draggingRef = useRef<Dragging | null>(null)
  draggingRef.current = dragging
  const [choosing, setChoosing] = useState<Choosing | null>(null)
  const choosingRef = useRef<Choosing | null>(null)
  choosingRef.current = choosing
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

  // The dragged occurrence as it would land on the day under the pointer,
  // laid out like any other so it shows on every day it would cover;
  // nothing while it has not left its day or hovers a calendar row.
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

  // Each day's occurrences in the two groups a cell draws: bars for the
  // all-day and multi-day ones, one on every day they cover, and chips for
  // the timed ones within a day. Each group runs by start, all-day before
  // timed at the same start, then by title; the lifted copy leads its group
  // wherever it falls, so the days it would land on show it.
  const lists = useMemo(() => {
    const out = new Map<
      string,
      { bars: CalendarEvent[]; chips: CalendarEvent[] }
    >()
    const first = days[0]
    const last = days[days.length - 1]
    if (!first || !last) return out
    const slot = (day: string) => {
      let list = out.get(day)
      if (!list) {
        list = { bars: [], chips: [] }
        out.set(day, list)
      }
      return list
    }
    for (const event of laid) {
      const begins = format.zonedDay(new Date(event.start * 1000))
      const ends = format.zonedDay(new Date((event.finish - 1) * 1000))
      if (!event.allday && begins === ends) {
        slot(begins).chips.push(event)
        continue
      }
      const covered = coveredDays(event, format.zonedDay)
      const to = covered.finish < last ? covered.finish : last
      for (
        let day = covered.start > first ? covered.start : first;
        day <= to;
        day = addDays(day, 1)
      )
        slot(day).bars.push(event)
    }
    const leads = (event: CalendarEvent) =>
      event.key === tentative?.key ? 1 : 0
    const order = (a: CalendarEvent, b: CalendarEvent) =>
      leads(b) - leads(a) ||
      a.start - b.start ||
      Number(b.allday) - Number(a.allday) ||
      naturalCompare(a.title, b.title)
    for (const list of out.values()) {
      list.bars.sort(order)
      list.chips.sort(order)
    }
    return out
  }, [laid, days, tentative, format])

  // How many of each day's events its cell cuts off, wholly or in part,
  // counted from where each one sits rather than from a line height, so a gap,
  // the font size or the cell's own scroll cannot throw the count.
  const measure = useCallback(() => {
    const next = new Map<string, number>()
    for (const cell of body.current?.querySelectorAll<HTMLElement>(
      '[data-day]'
    ) ?? []) {
      const day = cell.dataset.day
      if (!day) continue
      let hidden = 0
      for (const group of cell.querySelectorAll<HTMLElement>(
        '[data-band], [data-list]'
      )) {
        if (group.clientHeight === 0) continue
        if (group.scrollHeight <= group.clientHeight) continue
        const box = group.getBoundingClientRect()
        for (const item of group.querySelectorAll<HTMLElement>('[data-key]')) {
          const rect = item.getBoundingClientRect()
          if (rect.top < box.top - 0.5 || rect.bottom > box.bottom + 0.5) {
            hidden++
          }
        }
      }
      if (hidden) next.set(day, hidden)
    }
    setOverflow((current) => {
      if (
        current.size === next.size &&
        [...next].every(([day, count]) => current.get(day) === count)
      )
        return current
      return next
    })
  }, [])

  useLayoutEffect(() => measure(), [measure, lists, rowHeight, overflow])

  // A cell scrolled by hand shows other events, so its count follows. The
  // grid's own scroll moves every cell together and changes no count.
  useEffect(() => {
    const element = body.current
    if (!element) return
    const scrolled = (event: Event) => {
      if (event.target !== element) measure()
    }
    element.addEventListener('scroll', scrolled, true)
    return () => element.removeEventListener('scroll', scrolled, true)
  }, [measure])

  /**
   * The most height a day's first group may take when the day has a second:
   * what leaves room for one of the second's entries, and never less than
   * one of its own; the rest of it scrolls. With no second group it takes
   * the whole day.
   */
  const hold = (own: number, other: number) =>
    Math.max(own, rowHeight - HEADER - 2 - other)

  // --- Dragging a chip onto another day ---

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
        day: current.start,
        copy: current.copy,
        calendar: current.calendar,
      })
      return
    }
    if (current.day === current.from) return
    if (!current.keyboard) swallow()
    onMove({
      key: current.event.key,
      day: addDays(current.start, daysBetween(current.from, current.day)),
      copy: current.copy,
    })
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

  // The lifted copy leads its group in every day it would cover, so each
  // of those lists shows its top however far it was scrolled.
  useEffect(() => {
    if (!tentative) return
    const copies = body.current?.querySelectorAll<HTMLElement>(
      '[data-testid="ghost"]'
    )
    for (const element of copies ?? []) {
      const list = element.closest<HTMLElement>('[data-list], [data-band]')
      if (list) list.scrollTop = 0
    }
  }, [lists, tentative])

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

  /** The first day of an occurrence taken by its entry on `day`. */
  const firstDay = (item: CalendarEvent, day: string, bar: boolean) =>
    bar ? coveredDays(item, format.zonedDay).start : day

  const startMove = (
    event: React.PointerEvent,
    item: CalendarEvent,
    day: string,
    start: string
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
        start,
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
    day: string,
    start: string
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
      start,
      copy: false,
      keyboard: true,
    }
    const next = addDays(base.day, shift)
    if (!days.includes(next)) onStep?.(shift < 0 ? -1 : 1)
    setDragging({ ...base, day: next })
  }

  // --- Dragging across empty cells to pick a new event's days ---

  const choose = (next: Choosing | null) => {
    choosingRef.current = next
    setChoosing(next)
  }

  /**
   * Arms a pick on an empty part of a cell: a mouse picks once it has moved,
   * a finger after the hold, so a click still creates on its one day and a
   * swipe still scrolls.
   */
  const startChoose = (event: React.PointerEvent, day: string) => {
    if (!onCreateRange) return
    if (event.pointerType === 'mouse' && event.button !== 0) return
    if ((event.target as Element).closest('button')) return
    touch.current = event.pointerType === 'touch'
    arming.current?.()
    arming.current = arm(event, (moved) => {
      arming.current = null
      const under = moved ? dayAt(moved.clientX, moved.clientY) : null
      choose({ anchor: day, day: under ?? day })
    })
  }

  const chosen = () => {
    const current = choosingRef.current
    if (!current) return
    choose(null)
    // The release is followed by a click on the cell under it, which would
    // create on that one day as well.
    swallow()
    const [first, last] = runEnds(current)
    if (first === last) onCreate(first)
    else onCreateRange?.(first, last)
  }
  const picking = useRef(chosen)
  picking.current = chosen

  const active = choosing !== null
  useEffect(() => {
    if (!active) return
    const move = (event: PointerEvent) => {
      const current = choosingRef.current
      const day = dayAt(event.clientX, event.clientY)
      if (current && day && day !== current.day) choose({ ...current, day })
    }
    const up = (event: PointerEvent) => {
      move(event)
      picking.current()
    }
    const lost = () => choose(null)
    const key = (event: KeyboardEvent) => {
      if (event.key === 'Escape') lost()
    }
    const still = (event: TouchEvent) => event.preventDefault()
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
    window.addEventListener('pointercancel', lost)
    window.addEventListener('keydown', key)
    if (touch.current)
      document.addEventListener('touchmove', still, { passive: false })
    document.body.style.setProperty('user-select', 'none')
    return () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      window.removeEventListener('pointercancel', lost)
      window.removeEventListener('keydown', key)
      document.removeEventListener('touchmove', still)
      document.body.style.removeProperty('user-select')
    }
  }, [active])

  /** Whether a day falls in the run being picked. */
  const picked = (day: string) => {
    if (!choosing) return false
    const [first, last] = runEnds(choosing)
    return day >= first && day <= last
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

  /** Over already, or cancelled, and drawn quieter. */
  const over = (event: CalendarEvent) =>
    event.status === 'cancelled' ||
    finished(event, Date.now() / 1000, today, format.zonedDay)

  /** An event's start, in its own zone when it has one. */
  const clock = (event: CalendarEvent) =>
    format.formatClock(new Date(event.start * 1000), event.zone?.start)

  // The title, then under it, aligned with it: the time, how it repeats,
  // and whether it has a reminder.
  const chipContent = (event: CalendarEvent, lifted: boolean) => (
    <>
      <span className='flex min-w-0 items-center gap-1.5'>
        <EventDot event={event} />
        {lifted && dragging?.copy && (
          <Copy className='size-3 shrink-0' aria-label={t`Copy`} />
        )}
        <EventTitle
          event={event}
          className={cn('flex-1', lifted && 'font-medium')}
        />
      </span>
      <span className='text-muted-foreground flex items-center gap-1 ps-3.5 text-xs leading-4'>
        {!event.allday && <span className='shrink-0'>{clock(event)}</span>}
        {!lifted && <RepeatMark event={event} />}
        {!lifted && <AlarmMark event={event} />}
      </span>
    </>
  )

  /** Whether this is the lifted copy, drawn where it would land. */
  const carried = (event: CalendarEvent) =>
    dragging !== null && event.key === tentative?.key

  // Focus follows the lifted copy of a keyboard drag to the day it is on,
  // which is the one of its entries that takes the ghost reference.
  const ghostRef = (day: string) =>
    dragging && day === dragging.day ? ghost : undefined

  const chipButton = (event: CalendarEvent, day: string) =>
    dragging && carried(event) ? (
      <div
        key={event.key}
        ref={ghostRef(day)}
        tabIndex={-1}
        data-testid='ghost'
        onKeyDown={(pointer) =>
          keyed(pointer, dragging.event, dragging.from, dragging.start)
        }
        className='bg-surface-2 pointer-events-none flex w-full shrink-0 flex-col justify-center overflow-hidden rounded-md border px-2 text-start text-sm leading-5 shadow-md outline-none'
        style={{ height: `${CHIP - 2}px` }}
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
          startMove(pointer, event, day, day)
        }}
        onClick={(pointer) => {
          pointer.stopPropagation()
          onSelect(event.key, pointer.currentTarget)
        }}
        onKeyDown={(pointer) => keyed(pointer, event, day, day)}
        title={tooltip(event)}
        className={cn(
          'hover:bg-hover flex w-full shrink-0 flex-col justify-center overflow-hidden rounded-md px-2 text-start text-sm leading-5',
          faded(event) ? 'opacity-40' : over(event) && 'opacity-60',
          event.readonly ? 'cursor-pointer' : 'cursor-grab',
          event.key === selected && 'bg-primary/10'
        )}
        style={{ height: `${CHIP - 2}px` }}
      >
        {chipContent(event, false)}
      </button>
    )

  // An all-day or multi-day occurrence, on one line in each day it covers;
  // a timed one says its start on its first day.
  const barButton = (event: CalendarEvent, day: string) => {
    const start = firstDay(event, day, true)
    return dragging && carried(event) ? (
      <div
        key={event.key}
        ref={ghostRef(day)}
        tabIndex={-1}
        data-testid='ghost'
        onKeyDown={(pointer) =>
          keyed(pointer, dragging.event, dragging.from, dragging.start)
        }
        className='bg-surface-2 pointer-events-none flex w-full shrink-0 items-center gap-1.5 overflow-hidden rounded-md border px-2 text-start text-sm shadow-md outline-none'
        style={{ height: `${BAR - 2}px` }}
      >
        <EventDot event={event} />
        {dragging.copy && (
          <Copy className='size-3 shrink-0' aria-label={t`Copy`} />
        )}
        <EventTitle event={event} className='flex-1 font-medium' />
      </div>
    ) : (
      <button
        key={event.key}
        type='button'
        data-key={event.key}
        onPointerDown={(pointer) => {
          pointer.stopPropagation()
          startMove(pointer, event, day, start)
        }}
        onClick={(pointer) => {
          pointer.stopPropagation()
          onSelect(event.key, pointer.currentTarget)
        }}
        onKeyDown={(pointer) => keyed(pointer, event, day, start)}
        className={cn(
          'hover:bg-hover flex w-full shrink-0 items-center gap-1.5 overflow-hidden rounded-md px-2 text-start text-sm',
          faded(event) ? 'opacity-40' : over(event) && 'opacity-60',
          event.readonly ? 'cursor-pointer' : 'cursor-grab',
          event.key === selected && 'bg-primary/10'
        )}
        style={{ height: `${BAR - 2}px` }}
        title={tooltip(event)}
      >
        <EventDot event={event} />
        <EventTitle event={event} className='flex-1' />
        <EventMarks event={event} />
        {!event.allday && day === start && (
          <span className='text-muted-foreground shrink-0'>{clock(event)}</span>
        )}
      </button>
    )
  }

  return (
    <div
      className='flex h-full min-h-0 flex-col'
      onWheel={(event) => {
        // A day whose events overflow it scrolls them; the rest of the grid
        // pages.
        if (scrolls(event.target)) return
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
        {rows.map((week) => (
          <div key={week[0]} className='flex min-h-0 flex-1 border-b'>
            {weekNumbers && (
              <div
                data-testid='week-number'
                className='text-muted-foreground w-8 shrink-0 pt-1 text-center text-[0.6875rem]'
              >
                {/* The middle day is in the ISO week most of the row is in,
                    whichever day the week starts on. */}
                {weekNumber(week[Math.min(3, week.length - 1)])}
              </div>
            )}
            <div className='grid flex-1 grid-cols-7'>
              {week.map((day) => {
                const outside = month !== undefined && monthOf(day) !== month
                const list = lists.get(day)
                const bars = {
                  events: list?.bars ?? [],
                  line: BAR,
                  draw: barButton,
                  band: true,
                }
                const chips = {
                  events: list?.chips ?? [],
                  line: CHIP,
                  draw: chipButton,
                  band: false,
                }
                // Both groups stack from the top of the day; the first is held
                // so one of the second stays in view.
                const [upper, lower] =
                  allday === 'last' ? [chips, bars] : [bars, chips]
                const groups = [upper, lower].filter(
                  (group) => group.events.length > 0
                )
                const landing =
                  dragging && !dragging.calendar && dragging.day === day
                    ? dragging
                    : null
                return (
                  <div
                    key={day}
                    data-day={day}
                    className={cn(
                      'hover:bg-hover/40 flex min-h-0 cursor-pointer flex-col border-s first:border-s-0',
                      outside && 'bg-muted/30',
                      (landing || picked(day)) && 'bg-primary/10'
                    )}
                    onPointerDown={(pointer) => startChoose(pointer, day)}
                    onClick={(pointer) => {
                      // Anywhere in the cell but on an event or its number.
                      if (!(pointer.target as Element).closest('button'))
                        onCreate(day)
                    }}
                  >
                    <div
                      className={cn(
                        'flex shrink-0 justify-end px-1 py-0.5',
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
                    <div className='flex min-h-0 flex-1 flex-col px-0.5 pb-0.5'>
                      {groups.map((group, index) => {
                        const held = index === 0 && groups.length > 1
                        return (
                          <div
                            key={group.band ? 'bars' : 'chips'}
                            {...(group.band
                              ? { 'data-band': '' }
                              : { 'data-list': '' })}
                            className={cn(
                              'flex flex-col gap-0.5 overflow-y-auto overscroll-contain',
                              held ? 'shrink-0' : 'min-h-0 flex-1',
                              held && 'pb-0.5'
                            )}
                            style={
                              held
                                ? {
                                    maxHeight: `${hold(group.line, groups[1].line)}px`,
                                  }
                                : undefined
                            }
                          >
                            {group.events.map((event) =>
                              group.draw(event, day)
                            )}
                          </div>
                        )
                      })}
                    </div>
                    {(overflow.get(day) ?? 0) > 0 && (
                      <button
                        type='button'
                        className='text-primary shrink-0 px-1 py-0.5 text-start text-xs font-medium hover:underline'
                        onClick={() => onDay(day)}
                      >
                        <Plural
                          value={overflow.get(day) ?? 0}
                          one='+# more'
                          other='+# more'
                        />
                      </button>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        ))}
      </div>
      {dragging && !dragging.calendar && (
        <span className='sr-only' aria-live='polite'>
          {t`Moving to ${dayName(dragging.day)}`}
        </span>
      )}
    </div>
  )
}

/** Whether a wheel over this element scrolls one of a day's lists. */
function scrolls(target: EventTarget) {
  if (!(target instanceof Element)) return false
  const list = target.closest<HTMLElement>('[data-list], [data-band]')
  return list !== null && list.scrollHeight > list.clientHeight
}

function EventMarks({ event }: { event: CalendarEvent }) {
  // Beside the time on one line: a reminder, then how it repeats.
  return (
    <>
      <AlarmMark event={event} />
      <RepeatMark event={event} />
    </>
  )
}

function AlarmMark({ event }: { event: CalendarEvent }) {
  const { t } = useLingui()
  if (!event.alarm) return null
  return (
    <Bell className='size-3 shrink-0 opacity-70' aria-label={t`Reminder`} />
  )
}

function RepeatMark({ event }: { event: CalendarEvent }) {
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
