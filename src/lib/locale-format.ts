// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: Apache-2.0

// Locale-aware formatting utilities.
// All functions are pure — they take the format preference as a parameter.

function pad(n: number): string {
  return n < 10 ? '0' + n : String(n)
}

// --- User-facing formatting (respects preferences) ---

export type DateFormat = 'YYYY-MM-DD' | 'DD/MM/YYYY' | 'DD.MM.YYYY' | 'MM/DD/YYYY' | 'D MMM YYYY'
export type TimeFormat = '12h' | '24h'
export type TimestampDisplay = 'auto' | 'relative' | 'absolute'
export type NumberFormat = '1,000.00' | '1.000,00' | '1 000,00' | "1'000.00" | '1,00,000.00'

export function formatDate(date: Date, dateFormat: DateFormat): string {
  const y = date.getFullYear()
  const m = pad(date.getMonth() + 1)
  const d = pad(date.getDate())
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
      return `${date.getDate()} ${date.toLocaleString('en', { month: 'short' })} ${y}`
  }
}

export function formatTime(date: Date, timeFormat: TimeFormat): string {
  if (timeFormat === '12h') {
    let h = date.getHours()
    const ampm = h >= 12 ? 'PM' : 'AM'
    h = h % 12 || 12
    return `${h}:${pad(date.getMinutes())}:${pad(date.getSeconds())} ${ampm}`
  }
  return `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
}

export function formatDateTime(date: Date, dateFormat: DateFormat, timeFormat: TimeFormat): string {
  return `${formatDate(date, dateFormat)} ${formatTime(date, timeFormat)}`
}

export type ResolvedLocaleForTimestamp = {
  dateFormat: DateFormat
  timeFormat: TimeFormat
  timestampDisplay: TimestampDisplay
}

/** Compact relative time: Just now, 5m, 3h, 2d, 3w, then date */
export function formatRelativeTime(timestamp: number, dateFormat: DateFormat): string {
  const now = Date.now() / 1000
  const diff = now - timestamp

  if (diff < 60) return 'Just now'
  if (diff < 3600) return `${Math.floor(diff / 60)}m`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`
  if (diff < 604800) return `${Math.floor(diff / 86400)}d`
  if (diff < 2592000) return `${Math.floor(diff / 604800)}w`

  return formatDate(new Date(timestamp * 1000), dateFormat)
}

/** Format a Unix timestamp for user display, respecting timestamp_display preference */
export function formatUserTimestamp(timestamp: number, locale: ResolvedLocaleForTimestamp, fallback = ''): string {
  if (!timestamp) return fallback
  if (locale.timestampDisplay === 'auto') {
    // Relative for recent past (< 24h ago), absolute otherwise. Future
    // timestamps always use absolute so "in 30 days" reads as a real date
    // rather than "Just now".
    const diff = Date.now() / 1000 - timestamp
    if (diff >= 0 && diff < 86400) {
      return formatRelativeTime(timestamp, locale.dateFormat)
    }
    return formatDateTime(new Date(timestamp * 1000), locale.dateFormat, locale.timeFormat)
  }
  if (locale.timestampDisplay === 'relative') {
    return formatRelativeTime(timestamp, locale.dateFormat)
  }
  return formatDateTime(new Date(timestamp * 1000), locale.dateFormat, locale.timeFormat)
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

export function formatNumber(value: number, numberFormat: NumberFormat, decimals?: number): string {
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
export function formatPrice(amount: number, symbol: string, numberFormat: NumberFormat): string {
  return `${symbol}${formatNumber(amount / 100, numberFormat, 2)}`
}

/** Format a byte count as a human-readable file size (e.g. 1048576 → "1.0 MB") */
export function formatFileSize(bytes: number, numberFormat: NumberFormat): string {
  if (bytes < 1024) return `${formatNumber(bytes, numberFormat, 0)} B`
  if (bytes < 1024 * 1024) return `${formatNumber(bytes / 1024, numberFormat, 1)} KB`
  if (bytes < 1024 * 1024 * 1024) return `${formatNumber(bytes / (1024 * 1024), numberFormat, 1)} MB`
  return `${formatNumber(bytes / (1024 * 1024 * 1024), numberFormat, 1)} GB`
}

// --- System formatting (always fixed, ignores preferences) ---

/** Always YYYY-MM-DD HH:MM:SS — for admin pages, logs, diagnostics */
export function formatSystemTimestamp(timestamp?: number, fallback = ''): string {
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
