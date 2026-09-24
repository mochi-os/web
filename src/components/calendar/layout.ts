// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: Apache-2.0

// Pure calendar layout. Every function here works on civil days - a day is the
// string YYYY-MM-DD as it reads in the user's own zone - and on minutes since
// midnight, so nothing in a view depends on the browser's zone or on Date
// arithmetic across a daylight-saving change.

export type CalendarView = 'day' | 'week' | 'multiweek' | 'month' | 'list'

/** The span a view shows, and the day it is anchored on. */
export interface CalendarRange {
  /** The first day shown. */
  from: string
  /** How many days are shown. */
  days: number
  /** The day the view is anchored on; a month titles by its month. */
  date: string
}

export interface RangeOptions {
  /** 0 = Sunday through 6 = Saturday, from the user's locale. */
  weekStartsOn: number
  /** Multiweek: how many weeks to show. */
  weeks: number
  /** Multiweek: how many weeks before the current one. */
  previous: number
}

const DAY = 86400000

function utc(day: string): number {
  const [year, month, date] = day.split('-').map(Number)
  return Date.UTC(year, month - 1, date)
}

function key(value: number): string {
  const date = new Date(value)
  const month = date.getUTCMonth() + 1
  const day = date.getUTCDate()
  return `${date.getUTCFullYear()}-${month < 10 ? '0' : ''}${month}-${day < 10 ? '0' : ''}${day}`
}

/** The day `count` days after `day`; a negative count moves back. */
export function addDays(day: string, count: number): string {
  return key(utc(day) + count * DAY)
}

/**
 * The day `count` months after `day`, keeping the day of the month where the
 * target month is long enough and clamping to its last day where it is not.
 */
export function addMonths(day: string, count: number): string {
  const [year, month, date] = day.split('-').map(Number)
  const total = year * 12 + (month - 1) + count
  const targetYear = Math.floor(total / 12)
  const targetMonth = total - targetYear * 12
  const last = new Date(Date.UTC(targetYear, targetMonth + 1, 0)).getUTCDate()
  return key(Date.UTC(targetYear, targetMonth, Math.min(date, last)))
}

/** Whole days from `from` to `to`; negative when `to` is earlier. */
export function daysBetween(from: string, to: string): number {
  return Math.round((utc(to) - utc(from)) / DAY)
}

/** 0 = Sunday through 6 = Saturday. */
export function dayOfWeek(day: string): number {
  return new Date(utc(day)).getUTCDay()
}

/** The first day of the week `day` falls in. */
export function startOfWeek(day: string, weekStartsOn: number): string {
  const shift = (dayOfWeek(day) - weekStartsOn + 7) % 7
  return addDays(day, -shift)
}

/** The first day of the month `day` falls in. */
export function startOfMonth(day: string): string {
  return `${day.slice(0, 8)}01`
}

/** The year `day` falls in. */
export function yearOf(day: string): number {
  return Number(day.slice(0, 4))
}

/** Months from the month of `from` to the month of `to`, negative going back. */
export function monthsBetween(from: string, to: string): number {
  return (yearOf(to) - yearOf(from)) * 12 + (monthOf(to) - monthOf(from))
}

/** The month `day` falls in, 1 through 12. */
export function monthOf(day: string): number {
  return Number(day.slice(5, 7))
}

/** `count` consecutive days starting at `from`. */
export function dayList(from: string, count: number): string[] {
  const out: string[] = []
  for (let index = 0; index < count; index++) out.push(addDays(from, index))
  return out
}

/** Splits a run of days into rows of seven, as a month grid draws them. */
export function weekRows(from: string, days: number): string[][] {
  const rows: string[][] = []
  for (let start = 0; start < days; start += 7) {
    rows.push(dayList(addDays(from, start), Math.min(7, days - start)))
  }
  return rows
}

/**
 * The ISO 8601 week number: weeks run Monday to Sunday and the week holding
 * the year's first Thursday is week 1, whatever the user's own week start.
 */
export function weekNumber(day: string): number {
  const thursday = addDays(day, 3 - ((dayOfWeek(day) + 6) % 7))
  const first = `${thursday.slice(0, 4)}-01-01`
  return Math.floor(daysBetween(first, thursday) / 7) + 1
}

/** The days a view shows for the day it is anchored on. */
export function viewRange(
  view: CalendarView,
  date: string,
  options: RangeOptions
): CalendarRange {
  switch (view) {
    case 'day':
      return { from: date, days: 1, date }
    case 'week':
      return { from: startOfWeek(date, options.weekStartsOn), days: 7, date }
    case 'multiweek': {
      const week = startOfWeek(date, options.weekStartsOn)
      return {
        from: addDays(week, -7 * options.previous),
        days: 7 * options.weeks,
        date,
      }
    }
    case 'month': {
      const first = startOfMonth(date)
      // Six rows always, so the grid keeps its height from month to month.
      return {
        from: startOfWeek(first, options.weekStartsOn),
        days: 42,
        date,
      }
    }
    case 'list':
      // The list scrolls on from the anchor day and fetches its own pages;
      // the range only names where it starts.
      return { from: date, days: 1, date }
  }
}

/**
 * The day to anchor on after a step forward (1) or back (-1). Multiweek steps
 * a week at a time, so the span slides a row rather than jumping its length.
 */
export function stepDate(
  view: CalendarView,
  date: string,
  direction: number
): string {
  switch (view) {
    case 'day':
      return addDays(date, direction)
    case 'week':
    case 'multiweek':
      return addDays(date, 7 * direction)
    case 'month':
      return addMonths(startOfMonth(date), direction)
    case 'list':
      return addMonths(startOfMonth(date), direction)
  }
}

/**
 * The first and last day an occurrence covers. An all-day occurrence is placed
 * by its own date and its whole-day count, never by its instants: the server
 * expands it in its zone, and a browser in another zone would otherwise draw
 * it a day out. A timed occurrence covers the days its instants fall on, each
 * end in its own zone when it has one and in the user's otherwise; a finish
 * on the stroke of midnight belongs to the day before. An occurrence whose
 * end falls, by the clock, before its start covers its start day alone.
 */
export function coveredDays(
  event: {
    allday: boolean
    date?: string
    start: number
    finish: number
    zone?: { start?: string; finish?: string }
  },
  zonedDay: (date: Date, zone?: string) => string
): { start: string; finish: string } {
  if (event.allday && event.date) {
    const days = Math.max(1, Math.round((event.finish - event.start) / 86400))
    return { start: event.date, finish: addDays(event.date, days - 1) }
  }
  const last = Math.max(event.start, event.finish - 1)
  const start = zonedDay(new Date(event.start * 1000), event.zone?.start)
  const finish = zonedDay(new Date(last * 1000), event.zone?.finish)
  return { start, finish: finish < start ? start : finish }
}

/** The clock an occurrence is read and written by, in a zone. */
export interface Clock {
  zonedDay: (date: Date, zone?: string) => string
  zonedMinutes: (date: Date, zone?: string) => number
  timestampAt: (day: string, minutes: number, zone?: string) => number
}

/**
 * The occurrence moved by whole days: each end keeps its clock reading in
 * its own zone, so a move across a clock change lands at the same time of
 * day, and an all-day occurrence keeps its date and its length.
 */
export function shiftedEvent<
  T extends {
    start: number
    finish: number
    allday: boolean
    date?: string
    zone?: { start?: string; finish?: string }
  },
>(event: T, days: number, clock: Clock): T {
  if (days === 0) return event
  if (event.allday) {
    return {
      ...event,
      start: event.start + days * 86400,
      finish: event.finish + days * 86400,
      date: event.date ? addDays(event.date, days) : event.date,
    }
  }
  const begins = new Date(event.start * 1000)
  const ends = new Date(event.finish * 1000)
  return {
    ...event,
    start: clock.timestampAt(
      addDays(clock.zonedDay(begins, event.zone?.start), days),
      clock.zonedMinutes(begins, event.zone?.start),
      event.zone?.start
    ),
    finish: clock.timestampAt(
      addDays(clock.zonedDay(ends, event.zone?.finish), days),
      clock.zonedMinutes(ends, event.zone?.finish),
      event.zone?.finish
    ),
  }
}

export interface RangeTitleFormat {
  /** A whole date spelled out: "Tuesday 16 September 2026". */
  longDate: (day: string) => string
  /** A month and its year: "September 2026". */
  monthYear: (day: string) => string
  /** A span of days: "14 - 20 September 2026". */
  dayRange: (from: string, to: string) => string
}

/** The toolbar's range title for a view. */
export function rangeTitle(
  view: CalendarView,
  range: CalendarRange,
  format: RangeTitleFormat
): string {
  if (view === 'day') return format.longDate(range.date)
  if (view === 'month' || view === 'list') return format.monthYear(range.date)
  return format.dayRange(range.from, addDays(range.from, range.days - 1))
}

// --- Timed event placement ---

export interface Span {
  /** Minutes since midnight. */
  start: number
  /** Minutes since midnight; may run past 1440 for an event crossing a day. */
  finish: number
}

/** Where one block sits across the width of a day column. */
export interface Placement {
  /** Which slot the block takes, counting from the start edge. */
  column: number
  /** How many slots the column is divided into. */
  columns: number
}

/**
 * Side-by-side placement of blocks that overlap in time. Blocks that overlap,
 * directly or through a chain of overlaps, share one cluster and divide its
 * width; a block that touches another end to end does not overlap it.
 *
 * Answers one placement per input span, in the order they were given.
 */
export function overlapColumns(spans: Span[]): Placement[] {
  const order = spans
    .map((span, index) => ({ span, index }))
    .sort(
      (a, b) =>
        a.span.start - b.span.start ||
        b.span.finish - b.span.start - (a.span.finish - a.span.start) ||
        a.index - b.index
    )

  const placements: Placement[] = spans.map(() => ({ column: 0, columns: 1 }))
  let cluster: number[] = []
  let clusterFinish = -Infinity
  // The finish of the block already sitting in each column of this cluster.
  let columns: number[] = []

  const close = () => {
    for (const index of cluster) placements[index].columns = columns.length || 1
    cluster = []
    columns = []
    clusterFinish = -Infinity
  }

  for (const { span, index } of order) {
    // A zero-length block still needs a slot, so a block starting exactly where
    // another ends is the only thing treated as not overlapping.
    const finish = Math.max(span.finish, span.start)
    if (span.start >= clusterFinish) close()
    let column = columns.findIndex((busy) => busy <= span.start)
    if (column === -1) {
      column = columns.length
      columns.push(finish)
    } else {
      columns[column] = finish
    }
    placements[index].column = column
    cluster.push(index)
    clusterFinish = Math.max(clusterFinish, finish)
  }
  close()
  return placements
}

// --- Multi-day bar placement ---

export interface Bar {
  /** Anything that identifies the bar to the caller. */
  key: string
  /** First day the bar covers. */
  start: string
  /** Last day the bar covers, inclusive. */
  finish: string
}

/** A bar clipped to one week's row, and the row it was stacked into. */
export interface BarPlacement {
  key: string
  /** Which column of the week the bar begins in, counting from 0. */
  column: number
  /** How many columns it covers. */
  span: number
  /** Which stacked row of the week it sits in, counting from 0. */
  row: number
  /** True when the bar began before this week. */
  before: boolean
  /** True when the bar runs on past this week. */
  after: boolean
}

/**
 * Stacks multi-day bars into the rows of one week, clipping each to the week
 * and never putting two overlapping bars in the same row. Bars are placed
 * longest first so the longest run sits at the top, and a bar outside the week
 * is dropped.
 */
export function barRows(week: string[], bars: Bar[]): BarPlacement[] {
  if (!week.length) return []
  const first = week[0]
  const last = week[week.length - 1]

  const clipped = bars
    .map((bar) => {
      const column = Math.max(0, daysBetween(first, bar.start))
      const finish = Math.min(week.length - 1, daysBetween(first, bar.finish))
      return {
        key: bar.key,
        column,
        span: finish - column + 1,
        before: daysBetween(first, bar.start) < 0,
        after: daysBetween(first, bar.finish) > week.length - 1,
        start: bar.start,
        finish: bar.finish,
      }
    })
    .filter(
      (bar) =>
        bar.span > 0 &&
        daysBetween(bar.start, last) >= 0 &&
        daysBetween(first, bar.finish) >= 0
    )
    .sort((a, b) => b.span - a.span || a.column - b.column)

  // rows[n] holds the columns already taken in stacked row n.
  const rows: boolean[][] = []
  const out: BarPlacement[] = []
  for (const bar of clipped) {
    let row = 0
    for (;;) {
      if (!rows[row]) rows[row] = []
      const taken = rows[row]
      let free = true
      for (let column = bar.column; column < bar.column + bar.span; column++) {
        if (taken[column]) {
          free = false
          break
        }
      }
      if (free) {
        for (
          let column = bar.column;
          column < bar.column + bar.span;
          column++
        ) {
          taken[column] = true
        }
        break
      }
      row++
    }
    out.push({
      key: bar.key,
      column: bar.column,
      span: bar.span,
      row,
      before: bar.before,
      after: bar.after,
    })
  }
  return out
}

/** Rounds minutes to the nearest step, never below zero. */
export function snap(minutes: number, step: number): number {
  if (step <= 0) return Math.max(0, Math.round(minutes))
  return Math.max(0, Math.round(minutes / step) * step)
}
