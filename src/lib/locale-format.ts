import { t, plural } from '@lingui/core/macro'
import { i18n } from '@lingui/core'
// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: Apache-2.0

// Locale-aware formatting utilities.
// All functions are pure — they take the format preference as a parameter.

function pad(n: number): string {
  return n < 10 ? '0' + n : String(n)
}

// The language the interface is shown in, which month names and meridiem
// markers follow - not the format preferences the other functions take. Intl is
// used directly here on purpose: this module is the canonical formatter,
// allowlisted in check-i18n-format.py, and call sites still go through
// useFormat().
function language(): string {
  return i18n.locale || 'en'
}

// Cached: constructing an Intl formatter is expensive relative to formatting,
// and these run per row in long lists.
const monthFormatters = new Map<string, Intl.DateTimeFormat>()
const meridiemFormatters = new Map<string, Intl.DateTimeFormat>()

// A formatter for the zone when Intl accepts it, else for the browser's own:
// an unusable stored preference degrades to local time rather than throwing
// inside a render, as zonedParts does.
function dateFormatter(
  lang: string,
  timezone: string | undefined,
  options: Intl.DateTimeFormatOptions
): Intl.DateTimeFormat {
  if (timezone) {
    try {
      return new Intl.DateTimeFormat(lang, { ...options, timeZone: timezone })
    } catch {
      // Fall through to the browser's zone.
    }
  }
  return new Intl.DateTimeFormat(lang, options)
}

function monthShort(date: Date, timezone?: string): string {
  const lang = language()
  const key = timezone ? lang + '|' + timezone : lang
  let formatter = monthFormatters.get(key)
  if (!formatter) {
    formatter = dateFormatter(lang, timezone, { month: 'short' })
    monthFormatters.set(key, formatter)
  }
  return formatter.format(date)
}

function meridiem(date: Date, timezone?: string): string {
  const lang = language()
  const key = timezone ? lang + '|' + timezone : lang
  let formatter = meridiemFormatters.get(key)
  if (!formatter) {
    formatter = dateFormatter(lang, timezone, { hour: 'numeric', hour12: true })
    meridiemFormatters.set(key, formatter)
  }
  // formatToParts rather than a string match: the marker's position and
  // spelling vary by language (Japanese puts 午前 first), so there is nothing
  // reliable to slice off the formatted string.
  const part = formatter.formatToParts(date).find((p) => p.type === 'dayPeriod')
  if (part) return part.value
  const parts = zonedParts(date, timezone)
  return (parts ? parts.hour : date.getHours()) >= 12 ? 'PM' : 'AM'
}

// Calendar fields as they read in `timezone`. Returns null for the browser's
// own zone (the caller then uses the plain Date getters) and for a zone Intl
// rejects, so an unusable preference degrades to local time rather than
// throwing inside a render.
type ZonedParts = {
  year: number
  month: number
  day: number
  hour: number
  minute: number
  second: number
}

const partFormatters = new Map<string, Intl.DateTimeFormat>()

function zonedParts(date: Date, timezone?: string): ZonedParts | null {
  if (!timezone) return null
  let formatter = partFormatters.get(timezone)
  if (!formatter) {
    try {
      formatter = new Intl.DateTimeFormat('en-US', {
        timeZone: timezone,
        hourCycle: 'h23',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      })
    } catch {
      return null
    }
    partFormatters.set(timezone, formatter)
  }
  const found: Record<string, string> = {}
  for (const part of formatter.formatToParts(date))
    found[part.type] = part.value
  if (!found.year) return null
  return {
    year: Number(found.year),
    month: Number(found.month),
    day: Number(found.day),
    // h23 should never produce 24, but engines have disagreed here and an
    // off-by-one-day hour is worse than a redundant guard.
    hour: Number(found.hour) % 24,
    minute: Number(found.minute),
    second: Number(found.second),
  }
}

// --- Calendar formatting ---
// A calendar reads and writes whole days in the user's own zone, and names
// weekdays and months in the interface language, neither of which the
// preference-driven formatters above cover. They live here because this module
// is the one place allowed to reach Intl directly.

// A day in the user's zone, as YYYY-MM-DD. Every calendar view addresses days
// by this string, so no view has to carry a Date whose meaning depends on the
// browser's own zone.
export function zonedDay(date: Date, timezone?: string): string {
  const parts = zonedParts(date, timezone)
  if (!parts) {
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
  }
  return `${parts.year}-${pad(parts.month)}-${pad(parts.day)}`
}

/** Minutes since midnight in the user's zone. */
export function zonedMinutes(date: Date, timezone?: string): number {
  const parts = zonedParts(date, timezone)
  if (!parts) return date.getHours() * 60 + date.getMinutes()
  return parts.hour * 60 + parts.minute
}

// How far the zone runs ahead of UTC at that instant, in seconds.
function zoneOffset(seconds: number, timezone?: string): number {
  const parts = zonedParts(new Date(seconds * 1000), timezone)
  if (!parts) return -new Date(seconds * 1000).getTimezoneOffset() * 60
  const asUtc =
    Date.UTC(
      parts.year,
      parts.month - 1,
      parts.day,
      parts.hour,
      parts.minute,
      parts.second
    ) / 1000
  return asUtc - seconds
}

/**
 * The instant a wall-clock time falls at in the user's zone, in unix seconds.
 * The second pass is what makes the hour after a DST change land correctly:
 * the offset is read at the first guess, which can sit on the other side of
 * the transition from the answer.
 */
export function timestampAt(
  day: string,
  minutes: number,
  timezone?: string
): number {
  const [year, month, date] = day.split('-').map(Number)
  const wall =
    Date.UTC(year, month - 1, date, Math.floor(minutes / 60), minutes % 60) /
    1000
  const first = wall - zoneOffset(wall, timezone)
  return wall - zoneOffset(first, timezone)
}

// Each shape gets its own cache: building an Intl formatter costs far more
// than formatting with it, and a week view asks for dozens per render.
const calendarFormatters = new Map<string, Intl.DateTimeFormat>()

function calendarFormatter(
  shape: string,
  timezone: string | undefined,
  options: Intl.DateTimeFormatOptions
): Intl.DateTimeFormat {
  const lang = language()
  const key = `${shape}|${lang}|${timezone ?? ''}`
  let formatter = calendarFormatters.get(key)
  if (!formatter) {
    formatter = dateFormatter(lang, timezone, options)
    calendarFormatters.set(key, formatter)
  }
  return formatter
}

/** The weekday's full name, as a column header reads it. */
export function formatWeekday(date: Date, timezone?: string): string {
  return calendarFormatter('weekday', timezone, { weekday: 'long' }).format(
    date
  )
}

/** The weekday abbreviated, for narrow column headers and the mini month. */
export function formatWeekdayShort(date: Date, timezone?: string): string {
  return calendarFormatter('weekdayShort', timezone, {
    weekday: 'short',
  }).format(date)
}

/** The month's full name on its own, as a mini-month heading reads it. */
export function formatMonthName(date: Date, timezone?: string): string {
  return calendarFormatter('month', timezone, { month: 'long' }).format(date)
}

/** The day of the month as a bare number, for a grid cell. */
export function formatDayNumber(date: Date, timezone?: string): string {
  return calendarFormatter('day', timezone, { day: 'numeric' }).format(date)
}

/** A whole date spelled out: "Tuesday 16 September 2026". */
export function formatLongDate(date: Date, timezone?: string): string {
  return calendarFormatter('long', timezone, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(date)
}

/** A month and its year: "September 2026". */
export function formatMonthYear(date: Date, timezone?: string): string {
  return calendarFormatter('monthYear', timezone, {
    month: 'long',
    year: 'numeric',
  }).format(date)
}

/**
 * A span of days the way the language writes one: "14 – 20 September 2026",
 * "14 September – 11 October 2026". formatRange is looked up structurally
 * because the apps compile against an ES2020 library that does not declare it;
 * where it is missing the two dates are joined plainly.
 */
export function formatDayRange(
  from: Date,
  to: Date,
  timezone?: string
): string {
  const formatter = calendarFormatter('dayRange', timezone, {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }) as Intl.DateTimeFormat & {
    formatRange?: (from: Date, to: Date) => string
  }
  if (typeof formatter.formatRange === 'function') {
    try {
      return formatter.formatRange(from, to)
    } catch {
      // Fall through to the plain join.
    }
  }
  return `${formatter.format(from)} - ${formatter.format(to)}`
}

/** A clock reading without seconds: "14:30", "2:30 PM". */
export function formatClock(
  date: Date,
  timeFormat: TimeFormat,
  timezone?: string
): string {
  const zoned = zonedParts(date, timezone)
  const hours = zoned ? zoned.hour : date.getHours()
  const minutes = zoned ? zoned.minute : date.getMinutes()
  if (timeFormat === '12h') {
    return `${hours % 12 || 12}:${pad(minutes)} ${meridiem(date, timezone)}`
  }
  return `${pad(hours)}:${pad(minutes)}`
}

/**
 * A time-grid axis label: "08:00", or "8 AM" where a whole hour needs no
 * minutes.
 */
export function formatHour(
  date: Date,
  timeFormat: TimeFormat,
  timezone?: string
): string {
  const zoned = zonedParts(date, timezone)
  const hours = zoned ? zoned.hour : date.getHours()
  const minutes = zoned ? zoned.minute : date.getMinutes()
  if (timeFormat === '12h' && minutes === 0) {
    return `${hours % 12 || 12} ${meridiem(date, timezone)}`
  }
  return formatClock(date, timeFormat, timezone)
}

// --- User-facing formatting (respects preferences) ---

export type DateFormat =
  'YYYY-MM-DD' | 'DD/MM/YYYY' | 'DD.MM.YYYY' | 'MM/DD/YYYY' | 'D MMM YYYY'
export type TimeFormat = '12h' | '24h'
export type TimestampDisplay = 'auto' | 'relative' | 'absolute'
export type NumberFormat =
  '1,000.00' | '1.000,00' | '1 000,00' | "1'000.00" | '1,00,000.00'

export function formatDate(
  date: Date,
  dateFormat: DateFormat,
  timezone?: string
): string {
  const zoned = zonedParts(date, timezone)
  const y = zoned ? zoned.year : date.getFullYear()
  const monthNumber = zoned ? zoned.month : date.getMonth() + 1
  const dayNumber = zoned ? zoned.day : date.getDate()
  const m = pad(monthNumber)
  const d = pad(dayNumber)
  switch (dateFormat) {
    case 'YYYY-MM-DD':
      return `${y}-${m}-${d}`
    case 'DD/MM/YYYY':
      return `${d}/${m}/${y}`
    case 'DD.MM.YYYY':
      return `${d}.${m}.${y}`
    case 'MM/DD/YYYY':
      return `${m}/${d}/${y}`
    case 'D MMM YYYY':
      return `${dayNumber} ${monthShort(date, timezone)} ${y}`
  }
}

export function formatTime(
  date: Date,
  timeFormat: TimeFormat,
  timezone?: string
): string {
  const zoned = zonedParts(date, timezone)
  const hours = zoned ? zoned.hour : date.getHours()
  const minutes = zoned ? zoned.minute : date.getMinutes()
  const seconds = zoned ? zoned.second : date.getSeconds()
  if (timeFormat === '12h') {
    const ampm = meridiem(date, timezone)
    const h = hours % 12 || 12
    return `${h}:${pad(minutes)}:${pad(seconds)} ${ampm}`
  }
  return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`
}

export function formatDateTime(
  date: Date,
  dateFormat: DateFormat,
  timeFormat: TimeFormat,
  timezone?: string
): string {
  return `${formatDate(date, dateFormat, timezone)} ${formatTime(date, timeFormat, timezone)}`
}

export type ResolvedLocaleForTimestamp = {
  dateFormat: DateFormat
  timeFormat: TimeFormat
  timestampDisplay: TimestampDisplay
  timezone?: string
}

/** Compact relative time: Just now, 5m, 3h, 2d, 3w, then date */
export function formatRelativeTime(
  timestamp: number,
  dateFormat: DateFormat,
  timezone?: string
): string {
  const now = Date.now() / 1000
  const diff = now - timestamp

  // The unit abbreviations are translated too: "m" for minutes is an English
  // convention. Kept as plurals so a language that inflects them can say so.
  if (diff < 60) return t`Just now`
  if (diff < 3600) {
    const count = Math.floor(diff / 60)
    return plural(count, { one: '#m', other: '#m' })
  }
  if (diff < 86400) {
    const count = Math.floor(diff / 3600)
    return plural(count, { one: '#h', other: '#h' })
  }
  if (diff < 604800) {
    const count = Math.floor(diff / 86400)
    return plural(count, { one: '#d', other: '#d' })
  }
  if (diff < 2592000) {
    const count = Math.floor(diff / 604800)
    return plural(count, { one: '#w', other: '#w' })
  }

  return formatDate(new Date(timestamp * 1000), dateFormat, timezone)
}

/** Format a Unix timestamp for user display, respecting timestamp_display preference */
export function formatUserTimestamp(
  timestamp: number,
  locale: ResolvedLocaleForTimestamp,
  fallback = ''
): string {
  if (!timestamp) return fallback
  if (locale.timestampDisplay === 'auto') {
    // Relative for recent past (< 24h ago), absolute otherwise. Future
    // timestamps always use absolute so "in 30 days" reads as a real date
    // rather than "Just now".
    const diff = Date.now() / 1000 - timestamp
    if (diff >= 0 && diff < 86400) {
      return formatRelativeTime(timestamp, locale.dateFormat, locale.timezone)
    }
    return formatDateTime(
      new Date(timestamp * 1000),
      locale.dateFormat,
      locale.timeFormat,
      locale.timezone
    )
  }
  if (locale.timestampDisplay === 'relative') {
    return formatRelativeTime(timestamp, locale.dateFormat, locale.timezone)
  }
  return formatDateTime(
    new Date(timestamp * 1000),
    locale.dateFormat,
    locale.timeFormat,
    locale.timezone
  )
}

// --- Number formatting ---

type NumberFormatParts = { group: string; decimal: string; indian: boolean }

const numberFormats: Record<NumberFormat, NumberFormatParts> = {
  '1,000.00': { group: ',', decimal: '.', indian: false },
  '1.000,00': { group: '.', decimal: ',', indian: false },
  '1 000,00': { group: '\u202F', decimal: ',', indian: false }, // narrow no-break space
  "1'000.00": { group: "'", decimal: '.', indian: false },
  '1,00,000.00': { group: ',', decimal: '.', indian: true },
}

export function formatNumber(
  value: number,
  numberFormat: NumberFormat,
  decimals?: number
): string {
  const fmt = numberFormats[numberFormat]
  const isNeg = value < 0
  const abs = Math.abs(value)
  const dec = decimals ?? (Number.isInteger(abs) ? 0 : 2)
  const fixed = abs.toFixed(dec)
  const [intPart, decPart] = fixed.split('.')

  let grouped: string
  if (fmt.indian) {
    // Indian grouping: last 3 digits, then groups of 2
    if (intPart.length <= 3) {
      grouped = intPart
    } else {
      const last3 = intPart.slice(-3)
      let rest = intPart.slice(0, -3)
      const parts: string[] = []
      while (rest.length > 2) {
        parts.unshift(rest.slice(-2))
        rest = rest.slice(0, -2)
      }
      if (rest) parts.unshift(rest)
      grouped = parts.join(fmt.group) + fmt.group + last3
    }
  } else {
    // Standard grouping: groups of 3
    const parts: string[] = []
    let remaining = intPart
    while (remaining.length > 3) {
      parts.unshift(remaining.slice(-3))
      remaining = remaining.slice(0, -3)
    }
    parts.unshift(remaining)
    grouped = parts.join(fmt.group)
  }

  const result = decPart ? grouped + fmt.decimal + decPart : grouped
  return isNeg ? '-' + result : result
}

/** Format a price from minor currency units (e.g. 1500 → "£15.00") */
export function formatPrice(
  amount: number,
  symbol: string,
  numberFormat: NumberFormat
): string {
  return `${symbol}${formatNumber(amount / 100, numberFormat, 2)}`
}

/** Format a byte count as a human-readable file size (e.g. 1048576 → "1.0 MB") */
export function formatFileSize(
  bytes: number,
  numberFormat: NumberFormat
): string {
  if (bytes < 1024) return `${formatNumber(bytes, numberFormat, 0)} B`
  if (bytes < 1024 * 1024)
    return `${formatNumber(bytes / 1024, numberFormat, 1)} KB`
  if (bytes < 1024 * 1024 * 1024)
    return `${formatNumber(bytes / (1024 * 1024), numberFormat, 1)} MB`
  return `${formatNumber(bytes / (1024 * 1024 * 1024), numberFormat, 1)} GB`
}

// --- System formatting (always fixed, ignores preferences) ---

/** Always YYYY-MM-DD HH:MM:SS — for admin pages, logs, diagnostics */
export function formatSystemTimestamp(
  timestamp?: number,
  fallback = ''
): string {
  if (!timestamp) return fallback
  const date = new Date(timestamp * 1000)
  const y = date.getFullYear()
  const m = pad(date.getMonth() + 1)
  const d = pad(date.getDate())
  const hh = pad(date.getHours())
  const mm = pad(date.getMinutes())
  const ss = pad(date.getSeconds())
  return `${y}-${m}-${d} ${hh}:${mm}:${ss}`
}

// Joins a list the way the language does - "a, b, or c", "a、b、c", "a ou b" -
// so no sentence is assembled from a translated fragment and a separator.
// Where the runtime has no list formatter the items are joined plainly.
export function formatList(
  items: string[],
  language: string,
  type: 'conjunction' | 'disjunction' = 'conjunction'
): string {
  // The apps compile against an ES2020 library, which has no ListFormat type;
  // the runtime has had it since 2019, so it is looked up structurally.
  const ListFormat = (
    Intl as unknown as {
      ListFormat?: new (
        language: string,
        options: { type: string }
      ) => { format(items: string[]): string }
    }
  ).ListFormat
  if (!ListFormat) return items.join(', ')
  try {
    return new ListFormat(language, { type }).format(items) // i18n-format-ok: the shared list formatter itself
  } catch {
    return items.join(', ')
  }
}

// How many decimals a stored number carries, so formatting it keeps them all.
export function decimalPlaces(value: string): number {
  const point = value.indexOf('.')
  return point < 0 ? 0 : value.length - point - 1
}
