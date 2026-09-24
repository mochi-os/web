// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: Apache-2.0

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useLingui } from '@lingui/react/macro'
import { Copy, History, Repeat, Repeat2 } from 'lucide-react'
import { cn } from '../../lib/utils'
import { useFormat } from '../../hooks/use-format'
import {
  addDays,
  barRows,
  coveredDays,
  dayOfWeek,
  daysBetween,
  overlapColumns,
  shiftedEvent,
  snap,
  type Bar,
  type BarPlacement,
} from './layout'
import {
  arm,
  Hold,
  hover,
  PAGE_EDGE,
  scroll,
  swallow,
  target,
  type Point,
} from './gesture'
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
  /**
   * A label for the gutter, the zone its hours read in, shown when the
   * occurrences may sit at times in other zones.
   */
  zone?: string
  /** Opens the occurrence's summary popover. */
  onSelect: (key: string, anchor: HTMLElement) => void
  /** A drag across empty grid, in unix seconds. */
  onCreate: (start: number, finish: number) => void
  /** A block dragged to a new time or calendar, or its end dragged. */
  onMove: (move: EventMove) => void
  /** A day header clicked. */
  onDay: (day: string) => void
  /**
   * The range before or after this one wanted: a block held at the grid's
   * side turns the page, 1 for the next range and -1 for the previous.
   */
  onStep?: (direction: number) => void
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
      event: CalendarEvent
      /** The day and clock the block sits at now; in the band, only the day. */
      day: string
      start: number
      band: boolean
      /** The block's height in minutes by the clock, for keeping it on the day. */
      length: number
      /** How long the occurrence really lasts, in seconds, which a move keeps. */
      duration: number
      /** The occurrence's own zones, which its new instants are read in. */
      zone?: { start?: string; finish?: string }
      grab: number
      /** Where it began, so a drop that never moved writes nothing. */
      from: { day: string; start: number; band: boolean }
      moved: boolean
      /** Alt held: a copy lands here and the original stays. */
      copy: boolean
      /** A calendar outside the grid under the pointer, which takes the block. */
      calendar?: string
      /** Driven by the arrow keys rather than the pointer. */
      keyboard: boolean
    }
  | {
      mode: 'resize'
      event: CalendarEvent
      day: string
      start: number
      finish: number
      zone?: { start?: string; finish?: string }
      from: number
      moved: boolean
      keyboard: boolean
    }

type Move = Extract<Drag, { mode: 'move' }>
type Resize = Extract<Drag, { mode: 'resize' }>

export function TimeGrid({
  days,
  events,
  duration,
  hours,
  workdays,
  today,
  zone,
  onSelect,
  onCreate,
  onMove,
  onDay,
  onStep,
}: TimeGridProps) {
  const { t } = useLingui()
  const format = useFormat()
  const tooltip = useEventTooltip()
  // A new or converted block is never shorter than the grid can show.
  const length = Math.max(MINIMUM, duration)
  const root = useRef<HTMLDivElement>(null)
  const scroller = useRef<HTMLDivElement>(null)
  const columns = useRef<HTMLDivElement>(null)
  const ghost = useRef<HTMLDivElement>(null)
  const [drag, setDrag] = useState<Drag | null>(null)
  const [minute, setMinute] = useState(() => Math.floor(Date.now() / 1000))
  // The pointer's last position, read by the frame that scrolls and pages
  // while it rests, and whether the drag began with a finger.
  const point = useRef<Point>({ x: 0, y: 0, alt: false })
  const touch = useRef(false)
  const edge = useRef(new Hold())
  // A pointer that went down and may yet become a drag.
  const arming = useRef<(() => void) | null>(null)
  // The block to give focus back to when a keyboard drag ends.
  const refocus = useRef<string | null>(null)
  const dragRef = useRef<Drag | null>(null)
  dragRef.current = drag

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

  // Nothing armed or marked outlives the grid.
  useEffect(
    () => () => {
      arming.current?.()
      hover(null)
    },
    []
  )

  const timed = useMemo(() => events.filter((e) => !e.allday), [events])
  const whole = useMemo(() => events.filter((e) => e.allday), [events])

  // Blocks per day, already placed side by side where they overlap. An
  // occurrence crossing midnight draws a block on each day it covers. Each
  // end is placed at its wall-clock time in its own zone when it has one, so
  // a flight can read 10:00 London to 13:00 New York; when that puts the end
  // before the start by the clock, the block sits on the start day alone, as
  // short as a block gets, and says so with a glyph.
  const blocks = useMemo(() => {
    const perDay = new Map<
      string,
      {
        event: CalendarEvent
        start: number
        finish: number
        backwards?: boolean
      }[]
    >()
    for (const day of days) perDay.set(day, [])
    for (const event of timed) {
      const begins = new Date(event.start * 1000)
      const ends = new Date(Math.max(event.start, event.finish) * 1000)
      const from = {
        day: format.zonedDay(begins, event.zone?.start),
        minutes: format.zonedMinutes(begins, event.zone?.start),
      }
      const to = {
        day: format.zonedDay(ends, event.zone?.finish),
        minutes: format.zonedMinutes(ends, event.zone?.finish),
      }
      // A finish on the stroke of midnight belongs to the day before.
      if (to.minutes === 0 && to.day > from.day) {
        to.day = addDays(to.day, -1)
        to.minutes = 1440
      }
      const backwards =
        to.day < from.day || (to.day === from.day && to.minutes < from.minutes)
      for (const day of days) {
        const list = perDay.get(day)
        if (!list || day < from.day) continue
        if (backwards) {
          if (day === from.day) {
            list.push({
              event,
              start: from.minutes,
              finish: from.minutes + MINIMUM,
              backwards: true,
            })
          }
          continue
        }
        if (day > to.day) continue
        list.push({
          event,
          start: day === from.day ? from.minutes : 0,
          finish: day === to.day ? to.minutes : 1440,
        })
      }
    }
    const out = new Map<
      string,
      {
        event: CalendarEvent
        start: number
        finish: number
        backwards?: boolean
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

  // The dragged occurrence as it would land in the band: an all-day bar
  // moved by whole days, or a timed one made all-day over as many days as it
  // covered, laid out like any other bar so it takes a row of its own and
  // spans every day. Nothing while it has not moved or hovers a calendar row.
  const landing = useMemo(() => {
    if (
      !drag ||
      drag.mode !== 'move' ||
      !drag.band ||
      drag.calendar ||
      !drag.moved
    )
      return null
    const { event } = drag
    const key = `${event.key}:lifted`
    if (event.allday) {
      const shift = daysBetween(drag.from.day, drag.day)
      return { ...shiftedEvent(event, shift, format), key }
    }
    const covered = coveredDays(event, format.zonedDay)
    const start = format.timestampAt(drag.day, 0)
    return {
      ...event,
      key,
      allday: true,
      date: drag.day,
      start,
      finish: start + (daysBetween(covered.start, covered.finish) + 1) * 86400,
    }
  }, [drag, format])

  // All-day and multi-day occurrences, stacked into the band above the grid.
  const bars = useMemo(() => {
    const laid = landing ? [...whole, landing] : whole
    const source: Bar[] = laid.map((event) => ({
      key: event.key,
      ...coveredDays(event, format.zonedDay),
    }))
    const byKey = new Map(laid.map((event) => [event.key, event]))
    const out: { placement: BarPlacement; event: CalendarEvent }[] = []
    for (const placement of barRows(days, source)) {
      const event = byKey.get(placement.key)
      if (event) out.push({ placement, event })
    }
    return out
  }, [days, whole, landing, format])

  const bandRows = bars.reduce(
    (most, item) => Math.max(most, item.placement.row + 1),
    0
  )

  // --- Pointer geometry ---

  const rtl = () =>
    typeof document !== 'undefined' && document.documentElement.dir === 'rtl'

  const pointAt = useCallback(
    (clientX: number, clientY: number) => {
      const element = columns.current
      if (!element) return null
      const rect = element.getBoundingClientRect()
      const across = rtl() ? rect.right - clientX : clientX - rect.left
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

  /** Above the hour grid is the all-day band. */
  const inBand = (clientY: number) => {
    const element = scroller.current
    return element ? clientY < element.getBoundingClientRect().top : false
  }

  /**
   * The page a drag resting at the grid's side wants: -1 at the start edge,
   * 1 at the end edge, 0 elsewhere or outside the grid altogether, where a
   * calendar in the sidebar may be the target instead.
   */
  const edgeAt = (x: number, y: number) => {
    const bounds = root.current?.getBoundingClientRect()
    const rect = columns.current?.getBoundingClientRect()
    if (!bounds || !rect) return 0
    if (
      x < bounds.left ||
      x > bounds.right ||
      y < bounds.top ||
      y > bounds.bottom
    )
      return 0
    const across = rtl() ? rect.right - x : x - rect.left
    if (across < PAGE_EDGE) return -1
    if (across > rect.width - PAGE_EDGE) return 1
    return 0
  }

  /**
   * The drag as it stands with the pointer at `at`: the calendar row or the
   * day and time under it. A move away and back again is no move at all.
   */
  const advance = useCallback(
    (current: Drag | null, at: Point): Drag | null => {
      if (!current) return null
      const { x, y, alt } = at
      const place = pointAt(x, y)
      if (current.mode === 'create') {
        return place
          ? { ...current, finish: snap(place.minutes, SNAP) }
          : current
      }
      if (current.keyboard) return current
      if (current.mode === 'resize') {
        if (!place) return current
        const end = Math.max(current.start + MINIMUM, snap(place.minutes, SNAP))
        return { ...current, finish: end, moved: end !== current.from }
      }
      const outside = target(x, y)
      hover(outside)
      const calendar = outside?.dataset.drop || undefined
      if (calendar) return { ...current, calendar, copy: alt, moved: true }
      if (!place) return { ...current, calendar: undefined, copy: alt }
      if (inBand(y)) {
        return {
          ...current,
          day: place.day,
          band: true,
          calendar: undefined,
          copy: alt,
          moved: !current.from.band || place.day !== current.from.day,
        }
      }
      const start = Math.max(
        0,
        Math.min(
          1440 - current.length,
          snap(place.minutes, SNAP) - current.grab
        )
      )
      return {
        ...current,
        day: place.day,
        start,
        band: false,
        calendar: undefined,
        copy: alt,
        moved:
          current.from.band ||
          place.day !== current.from.day ||
          start !== current.from.start,
      }
    },
    [pointAt]
  )

  /**
   * Reads the pointer's place into the drag. The reference is set at once,
   * so a release in the same breath as a move sees where the move went.
   */
  const update = useCallback(() => {
    const next = advance(dragRef.current, point.current)
    if (next === dragRef.current) return
    dragRef.current = next
    setDrag(next)
  }, [advance])

  const finish = useCallback(() => {
    const current = dragRef.current
    if (!current) return
    setDrag(null)
    hover(null)
    if (current.mode === 'create') {
      const from = Math.min(current.start, current.finish)
      const to = Math.max(current.start, current.finish)
      const start = format.timestampAt(current.day, from)
      // A click rather than a drag: the default length, as "New event" uses.
      const end =
        to - from < SNAP
          ? start + length * 60
          : format.timestampAt(current.day, to)
      onCreate(start, end)
      return
    }
    if (current.keyboard) refocus.current = current.event.key
    // A drop that never moved writes nothing.
    if (!current.moved) return
    if (!current.keyboard) swallow()
    const { key } = current.event
    if (current.mode === 'move') {
      if (current.calendar) {
        onMove({
          key,
          start: current.event.start,
          finish: current.event.finish,
          calendar: current.calendar,
          copy: current.copy,
        })
        return
      }
      if (current.band) {
        onMove({
          key,
          start: format.timestampAt(current.day, 0),
          finish: format.timestampAt(addDays(current.day, 1), 0),
          allday: true,
          copy: current.copy,
        })
        return
      }
      const start = format.timestampAt(
        current.day,
        current.start,
        current.zone?.start
      )
      onMove({
        key,
        start,
        finish: start + current.duration,
        copy: current.copy,
      })
      return
    }
    onMove({
      key,
      start: format.timestampAt(
        current.day,
        current.start,
        current.zone?.start
      ),
      finish: format.timestampAt(
        current.day,
        current.finish,
        current.zone?.finish
      ),
    })
  }, [length, format, onCreate, onMove])

  const cancel = useCallback(() => {
    const current = dragRef.current
    if (current && current.mode !== 'create' && current.keyboard)
      refocus.current = current.event.key
    setDrag(null)
    hover(null)
  }, [])

  // The latest callbacks, so the listeners below need attaching only once
  // per drag rather than on every pointer move.
  const live = useRef({ update, finish, cancel, onStep })
  live.current = { update, finish, cancel, onStep }

  // A pointer drag: the window's moves and release drive it, Escape drops
  // it, and a frame scrolls the day and turns the page while the pointer
  // rests at an edge.
  const pointing = drag !== null && (drag.mode === 'create' || !drag.keyboard)
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
    // Non-passive, and attached only now: the hold has already proved the
    // finger is not scrolling, and a browser ignores preventDefault once a
    // scroll is under way.
    const still = (event: TouchEvent) => event.preventDefault()
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
    window.addEventListener('pointercancel', lost)
    window.addEventListener('keydown', key)
    window.addEventListener('keyup', key)
    if (touch.current)
      document.addEventListener('touchmove', still, { passive: false })
    document.body.style.setProperty('user-select', 'none')
    const mode = dragRef.current?.mode
    if (!touch.current && mode !== 'create')
      document.body.style.setProperty(
        'cursor',
        mode === 'resize' ? 'ns-resize' : 'grabbing'
      )
    const held = edge.current
    let frame = 0
    const tick = () => {
      const { x, y } = point.current
      const current = dragRef.current
      const element = scroller.current
      if (element && scroll(element, y)) live.current.update()
      const direction =
        current?.mode === 'move' && !current.calendar ? edgeAt(x, y) : 0
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
    // eslint-disable-next-line react-hooks/exhaustive-deps -- edgeAt reads refs only
  }, [pointing])

  // A keyboard drag keeps focus on the block as it moves, and gives it back
  // to the block when it ends.
  useEffect(() => {
    if (drag && drag.mode !== 'create' && drag.keyboard) ghost.current?.focus()
    if (!drag && refocus.current) {
      const key = refocus.current
      refocus.current = null
      const blocks = root.current?.querySelectorAll<HTMLElement>('[data-key]')
      for (const element of blocks ?? []) {
        if (element.dataset.key === key) {
          element.focus()
          break
        }
      }
    }
  }, [drag])

  // A drag on a day the grid no longer shows, after the page turned, lands on
  // the day now under the pointer at the next move; until then it is not
  // drawn.

  // --- Starting drags ---

  const down = (event: React.PointerEvent) => {
    point.current = { x: event.clientX, y: event.clientY, alt: event.altKey }
    touch.current = event.pointerType === 'touch'
    arming.current?.()
  }

  /** Starts a drag and places it under the pointer at once. */
  const lift = (fresh: Drag) => {
    dragRef.current = fresh
    setDrag(fresh)
    update()
  }

  const startCreate = (event: React.PointerEvent, day: string) => {
    if (event.pointerType === 'mouse' && event.button !== 0) return
    const at = pointAt(event.clientX, event.clientY)
    if (!at) return
    const minutes = snap(at.minutes, SNAP)
    down(event)
    arming.current = arm(
      event,
      (moved) => {
        if (moved)
          point.current = {
            x: moved.clientX,
            y: moved.clientY,
            alt: moved.altKey,
          }
        arming.current = null
        // The span starts empty, so a drag of one step is told apart from a
        // click, which gets the default event length instead.
        lift({
          mode: 'create',
          day,
          anchor: minutes,
          start: minutes,
          finish: minutes,
        })
      },
      () => {
        arming.current = null
        const start = format.timestampAt(day, minutes)
        onCreate(start, start + length * 60)
      }
    )
  }

  const startMove = (
    event: React.PointerEvent,
    item: CalendarEvent,
    day: string,
    start: number,
    height: number,
    band = false
  ) => {
    // Stopped first: a read-only block must not fall through to the grid
    // beneath it and start creating an event.
    event.stopPropagation()
    if (item.readonly) return
    if (event.pointerType === 'mouse' && event.button !== 0) return
    const at = pointAt(event.clientX, event.clientY)
    if (!at) return
    down(event)
    const grab = band ? 0 : snap(at.minutes, SNAP) - start
    arming.current = arm(event, (moved) => {
      if (moved)
        point.current = {
          x: moved.clientX,
          y: moved.clientY,
          alt: moved.altKey,
        }
      arming.current = null
      lift({
        mode: 'move',
        event: item,
        day,
        start,
        band,
        // A bar dragged into the grid takes the default length there.
        length: band ? length : height,
        duration: band
          ? length * 60
          : Math.max(MINIMUM * 60, item.finish - item.start),
        zone: item.zone,
        grab,
        from: { day, start, band },
        moved: false,
        copy: point.current.alt,
        keyboard: false,
      })
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
    if (item.readonly) return
    if (event.pointerType === 'mouse' && event.button !== 0) return
    down(event)
    arming.current = arm(event, (moved) => {
      if (moved)
        point.current = {
          x: moved.clientX,
          y: moved.clientY,
          alt: moved.altKey,
        }
      arming.current = null
      lift({
        mode: 'resize',
        event: item,
        day,
        start,
        finish: end,
        zone: item.zone,
        from: end,
        moved: false,
        keyboard: false,
      })
    })
  }

  /**
   * The arrow keys move a focused block by one step, or a day; with Shift
   * they move its end. Enter drops it where it is and Escape puts it back.
   * The first arrow lifts the block; until then Enter opens it.
   */
  const keyed = (
    event: React.KeyboardEvent,
    item: CalendarEvent,
    day: string,
    start: number,
    height: number,
    band = false
  ) => {
    const current = dragRef.current
    const own =
      current &&
      current.mode !== 'create' &&
      current.keyboard &&
      current.event.key === item.key
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
    const vertical =
      event.key === 'ArrowUp' ? -1 : event.key === 'ArrowDown' ? 1 : 0
    const horizontal =
      event.key === 'ArrowLeft' ? -1 : event.key === 'ArrowRight' ? 1 : 0
    // A resize follows Shift; a move does not. A key of the other kind while
    // one is under way does nothing.
    if (event.shiftKey) {
      if (own?.mode === 'move' || band || horizontal) return
      const base: Resize =
        own?.mode === 'resize'
          ? own
          : {
              mode: 'resize',
              event: item,
              day,
              start,
              finish: start + height,
              zone: item.zone,
              from: start + height,
              moved: false,
              keyboard: true,
            }
      const end = Math.max(
        base.start + MINIMUM,
        Math.min(1440, base.finish + vertical * SNAP)
      )
      setDrag({ ...base, finish: end, moved: end !== base.from })
      return
    }
    if (own?.mode === 'resize') return
    const base: Move =
      own?.mode === 'move'
        ? own
        : {
            mode: 'move',
            event: item,
            day,
            start,
            band,
            length: band ? length : height,
            duration: band
              ? length * 60
              : Math.max(MINIMUM * 60, item.finish - item.start),
            zone: item.zone,
            grab: 0,
            from: { day, start, band },
            moved: false,
            copy: false,
            keyboard: true,
          }
    let next: Move = { ...base }
    if (horizontal) {
      // Left is earlier where the days run left to right.
      const shift = rtl() ? -horizontal : horizontal
      next.day = addDays(base.day, shift)
      if (!days.includes(next.day)) onStep?.(shift)
    } else if (base.band) {
      // Down leaves the band for the first working hour of the day.
      if (vertical > 0) next = { ...next, band: false, start: hours.start * 60 }
    } else if (base.start === 0 && vertical < 0) {
      // Up from the top of the day lifts the block into the band.
      next = { ...next, band: true }
    } else {
      next.start = Math.max(
        0,
        Math.min(1440 - base.length, base.start + vertical * SNAP)
      )
    }
    next.moved =
      next.day !== base.from.day ||
      next.band !== base.from.band ||
      (!next.band && next.start !== base.from.start)
    setDrag(next)
  }

  // --- What a dragged block says ---

  const clockAt = (day: string, minutes: number, zone?: string) =>
    format.formatClock(
      new Date(format.timestampAt(day, minutes, zone) * 1000),
      zone
    )

  /** The clock readings a dragged block would begin and end at. */
  const span = (current: Move | Resize): [string, string] => {
    if (current.mode === 'resize') {
      return [
        clockAt(current.day, current.start, current.zone?.start),
        clockAt(current.day, current.finish, current.zone?.finish),
      ]
    }
    const start = format.timestampAt(
      current.day,
      current.start,
      current.zone?.start
    )
    return [
      format.formatClock(new Date(start * 1000), current.zone?.start),
      format.formatClock(
        new Date((start + current.duration) * 1000),
        current.zone?.finish
      ),
    ]
  }

  /** The time a dragged block would land on, as its clock line reads. */
  const tentative = (current: Move | Resize): string => {
    if (current.mode === 'move' && current.band) return t`All day`
    const [from, to] = span(current)
    return t`${from} to ${to}`
  }

  const dayName = (day: string) =>
    format.formatLongDate(new Date(format.timestampAt(day, 720) * 1000))

  /** What a screen reader hears as a dragged block moves. */
  const said = (current: Drag): string => {
    if (current.mode === 'create') return ''
    if (current.mode === 'move' && current.calendar) return ''
    if (current.mode === 'move' && current.band) {
      return t`Moving to ${dayName(current.day)}`
    }
    const day = dayName(current.day)
    const [from, to] = span(current)
    return t`${day}, ${from} to ${to}`
  }

  const nowDay = format.zonedDay(new Date(minute * 1000))
  const nowMinutes = format.zonedMinutes(new Date(minute * 1000))

  const gridTemplate = {
    // eslint-disable-next-line lingui/no-unlocalized-strings -- a CSS grid template, never shown to anyone
    gridTemplateColumns: `repeat(${days.length}, minmax(0, 1fr))`,
  }

  const lifted = drag && drag.mode !== 'create' ? drag : null

  // The dragged block's element: focusable, so the arrow keys keep driving
  // it, and coloured as the block it stands for.
  const ghostProps = lifted
    ? {
        ref: ghost,
        tabIndex: -1,
        'data-testid': 'ghost',
        onKeyDown: (event: React.KeyboardEvent) =>
          keyed(
            event,
            lifted.event,
            lifted.day,
            lifted.start,
            lifted.mode === 'move'
              ? lifted.length
              : lifted.finish - lifted.start,
            lifted.mode === 'move' && lifted.band
          ),
      }
    : null
  const ghostColour = lifted
    ? {
        backgroundColor: `${lifted.event.colour}33`,
        borderInlineStartColor: lifted.event.colour,
      }
    : {}

  return (
    <div ref={root} className='flex h-full min-h-0 flex-col'>
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
                    'hover:bg-hover py-1 text-sm',
                    day === today &&
                      'bg-primary text-primary-foreground hover:bg-primary/90 font-semibold'
                  )}
                >
                  {format.formatWeekdayDay(date)}
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* All-day band */}
      <div className='flex border-b'>
        <div className='text-muted-foreground w-14 shrink-0 px-1 py-1.5 text-xs'>
          {zone && (
            <div
              className='truncate text-[10px] leading-3'
              data-testid='gutter-zone'
            >
              {zone}
            </div>
          )}
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
          {bars.map(({ placement, event }) => {
            if (lifted && event.key === landing?.key) {
              return (
                <div
                  key={placement.key}
                  {...ghostProps}
                  className='pointer-events-none absolute z-20 flex h-[26px] items-center gap-1.5 overflow-hidden rounded-sm border-s-[3px] px-2 text-start text-sm shadow-md outline-none'
                  style={{
                    ...ghostColour,
                    insetInlineStart: `${(placement.column / days.length) * 100}%`,
                    width: `calc(${(placement.span / days.length) * 100}% - 2px)`,
                    top: `${placement.row * 28 + 2}px`,
                  }}
                >
                  {lifted.mode === 'move' && lifted.copy && (
                    <Copy className='size-3 shrink-0' aria-label={t`Copy`} />
                  )}
                  <span className='truncate font-medium'>{event.title}</span>
                </div>
              )
            }
            // The dragged bar fades where it was once its copy is lifted
            // elsewhere; a copy leaves it whole.
            const dragging =
              lifted?.event.key === event.key &&
              lifted.mode === 'move' &&
              lifted.moved &&
              !lifted.copy
            return (
              <button
                key={placement.key}
                type='button'
                data-key={event.key}
                onPointerDown={(pointer) =>
                  startMove(
                    pointer,
                    event,
                    coveredDays(event, format.zonedDay).start,
                    0,
                    length,
                    true
                  )
                }
                onClick={(pointer) =>
                  onSelect(event.key, pointer.currentTarget)
                }
                onKeyDown={(pointer) =>
                  keyed(
                    pointer,
                    event,
                    coveredDays(event, format.zonedDay).start,
                    0,
                    length,
                    true
                  )
                }
                title={tooltip(event)}
                className={cn(
                  'absolute flex h-[26px] items-center gap-1.5 overflow-hidden rounded-sm border-s-[3px] px-2 text-start text-sm',
                  dragging && 'opacity-40',
                  event.readonly ? 'cursor-pointer' : 'cursor-grab'
                )}
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
            )
          })}
        </div>
      </div>

      {/* Hour grid */}
      <div
        ref={scroller}
        data-testid='scroller'
        className='min-h-0 flex-1 overflow-y-auto'
      >
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
            data-testid='hours'
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
                    const dragging = lifted?.event.key === item.event.key
                    // A resized block is drawn by its ghost alone; a moved one
                    // stays, faded, where it was, and whole when a copy lands.
                    if (dragging && lifted.mode === 'resize') return null
                    const start = item.start
                    const end = Math.max(item.finish, item.start + MINIMUM)
                    return (
                      <div
                        key={item.event.key}
                        role='button'
                        tabIndex={0}
                        data-key={item.event.key}
                        onPointerDown={(pointer) =>
                          startMove(
                            pointer,
                            item.event,
                            day,
                            item.start,
                            Math.max(MINIMUM, item.finish - item.start)
                          )
                        }
                        onClick={(pointer) =>
                          onSelect(item.event.key, pointer.currentTarget)
                        }
                        onKeyDown={(pointer) =>
                          keyed(
                            pointer,
                            item.event,
                            day,
                            item.start,
                            Math.max(MINIMUM, item.finish - item.start)
                          )
                        }
                        title={tooltip(item.event)}
                        className={cn(
                          'absolute z-10 overflow-hidden rounded-sm border-s-[3px] px-2 py-0.5 text-start text-sm leading-5',
                          dragging &&
                            !(lifted.mode === 'move' && lifted.copy) &&
                            'opacity-40',
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
                          <EventMarks
                            event={item.event}
                            backwards={item.backwards}
                          />
                          <span className='truncate font-medium'>
                            {item.event.title}
                          </span>
                        </div>
                        {((end - start) / 60) * HOUR >= TWO_LINES && (
                          <div className='text-muted-foreground truncate text-xs'>
                            {format.formatClock(
                              new Date(item.event.start * 1000),
                              item.event.zone?.start
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

                  {/* The dragged block, at the time it would land on, reading
                      that time where its clock line was. */}
                  {lifted &&
                    lifted.day === day &&
                    !(
                      lifted.mode === 'move' &&
                      (lifted.band || lifted.calendar)
                    ) && (
                      <div
                        {...ghostProps}
                        className='pointer-events-none absolute inset-x-0 z-20 overflow-hidden rounded-sm border-s-[3px] px-2 py-0.5 text-start text-sm leading-5 shadow-md outline-none'
                        style={{
                          ...ghostColour,
                          top: `${(lifted.start / 60) * HOUR}px`,
                          height: `${Math.max(
                            LINE,
                            (((lifted.mode === 'move'
                              ? lifted.start + lifted.length
                              : lifted.finish) -
                              lifted.start) /
                              60) *
                              HOUR -
                              1
                          )}px`,
                        }}
                      >
                        <div className='flex items-center gap-1 font-medium'>
                          {lifted.mode === 'move' && lifted.copy && (
                            <Copy
                              className='size-3 shrink-0'
                              aria-label={t`Copy`}
                            />
                          )}
                          <span className='truncate'>{tentative(lifted)}</span>
                        </div>
                        <div className='text-muted-foreground truncate text-xs'>
                          {lifted.event.title}
                        </div>
                      </div>
                    )}

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
      {lifted && (
        <span className='sr-only' aria-live='polite'>
          {said(lifted)}
        </span>
      )}
    </div>
  )
}

function EventMarks({
  event,
  backwards,
}: {
  event: CalendarEvent
  /** The end falls before the start by the clock, across zones. */
  backwards?: boolean
}) {
  const { t } = useLingui()
  if (backwards) {
    return (
      <History
        className='size-3 shrink-0 opacity-70'
        aria-label={t`Ends before it starts`}
      />
    )
  }
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
