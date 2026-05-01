import { createContext, useContext, useEffect, useState, useMemo } from 'react'
import { type LocalePreferences, getShellInitData, onShellMessage } from '../lib/shell-bridge'
import type { DateFormat, TimeFormat, TimestampDisplay, NumberFormat } from '../lib/locale-format'
import { setActiveLocale } from './i18n-provider'

export type ResolvedLocale = {
  dateFormat: DateFormat
  timeFormat: TimeFormat
  timestampDisplay: TimestampDisplay
  weekStartsOn: number // 0=Sunday, 1=Monday, ..., 6=Saturday
  numberFormat: NumberFormat
  units: 'metric' | 'imperial' | 'usa'
  timezone: string
}

type LocaleContextValue = {
  locale: ResolvedLocale
  raw: LocalePreferences
}

const defaultRaw: LocalePreferences = {
  date_format: 'auto',
  time_format: 'auto',
  timestamp_display: 'auto',
  week_start: 'auto',
  number_format: 'auto',
  units: 'auto',
  timezone: 'auto',
}

const defaultResolved: ResolvedLocale = {
  dateFormat: 'YYYY-MM-DD',
  timeFormat: '24h',
  timestampDisplay: 'auto',
  weekStartsOn: 1,
  numberFormat: '1,000.00',
  units: 'metric',
  timezone: 'UTC',
}

const LocaleContext = createContext<LocaleContextValue>({
  locale: defaultResolved,
  raw: defaultRaw,
})

// --- Auto-detection functions ---

export function detectDateFormat(): DateFormat {
  try {
    // Format a known date and inspect output to detect locale order
    const formatted = new Intl.DateTimeFormat(navigator.language, {
      year: 'numeric', month: '2-digit', day: '2-digit',
    }).format(new Date(2024, 0, 15)) // Jan 15, 2024

    if (formatted.startsWith('2024')) return 'YYYY-MM-DD'
    if (formatted.startsWith('15')) {
      // Check separator: dot vs slash
      if (formatted.includes('.')) return 'DD.MM.YYYY'
      return 'DD/MM/YYYY'
    }
    return 'MM/DD/YYYY'
  } catch {
    return 'YYYY-MM-DD'
  }
}

export function detectTimeFormat(): TimeFormat {
  try {
    const options = new Intl.DateTimeFormat(navigator.language, { hour: 'numeric' }).resolvedOptions()
    return options.hour12 ? '12h' : '24h'
  } catch {
    return '24h'
  }
}

const weekDayMap: Record<string, number> = {
  monday: 1, tuesday: 2, wednesday: 3, thursday: 4,
  friday: 5, saturday: 6, sunday: 0,
}

export function detectWeekStart(): number {
  try {
    const locale = new Intl.Locale(navigator.language)
    // getWeekInfo() is the standard API; weekInfo is the older accessor
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const loc = locale as any
    const info = loc.getWeekInfo?.() ?? loc.weekInfo
    if (info && typeof info === 'object' && 'firstDay' in info) {
      const day = (info as { firstDay: number }).firstDay
      // Intl uses 1=Monday...7=Sunday, convert to 0=Sunday...6=Saturday
      return day === 7 ? 0 : day
    }
  } catch { /* fallback */ }
  return 1 // monday
}

export function detectNumberFormat(): NumberFormat {
  try {
    const formatted = new Intl.NumberFormat(navigator.language).format(1234567.89)
    // Check decimal separator
    const hasCommaDec = formatted.includes(',89') || formatted.includes(',9')
    // Check group separator
    if (hasCommaDec) {
      if (formatted.includes('.')) return '1.000,00'
      if (formatted.includes('\u202F') || formatted.includes('\u00A0') || formatted.includes(' ')) return '1 000,00'
      return '1.000,00'
    }
    // Period decimal
    if (formatted.includes("'")) return "1'000.00"
    // Check for Indian grouping (1,23,45,678.89 pattern)
    const parts = formatted.split('.')
    const intPart = parts[0].replace(/[^0-9,]/g, '')
    const groups = intPart.split(',').filter(Boolean)
    if (groups.length >= 3 && groups[groups.length - 1].length === 3 && groups[groups.length - 2].length === 2) {
      return '1,00,000.00'
    }
    return '1,000.00'
  } catch {
    return '1,000.00'
  }
}

/**
 * Returns the browser's preferred BCP 47 language tag (lower-cased), or 'en'
 * if the browser does not expose one. Mirrors detectDateFormat / detectTimeFormat
 * etc. — used by the settings picker to display "Detect from web browser (X)"
 * for the `language=auto` option. The actual server-side resolution still
 * happens in core/server/labels.go::request_language, which falls through the
 * Accept-Language header when the user's preference is "auto" or unset.
 */
export function detectLanguage(): string {
  if (typeof navigator !== 'undefined' && navigator.language) {
    return navigator.language.toLowerCase()
  }
  return 'en'
}

export function detectUnits(): 'metric' | 'imperial' | 'usa' {
  try {
    const region = new Intl.Locale(navigator.language).region?.toUpperCase()
    if (region === 'US') return 'usa'
    if (region === 'GB' || region === 'MM' || region === 'LR') return 'imperial'
  } catch { /* fallback */ }
  return 'metric'
}

function detectTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone
  } catch {
    return 'UTC'
  }
}

function resolveLocale(raw: LocalePreferences): ResolvedLocale {
  return {
    dateFormat: raw.date_format === 'auto' ? detectDateFormat() : raw.date_format as DateFormat,
    timeFormat: raw.time_format === 'auto' ? detectTimeFormat() : raw.time_format as TimeFormat,
    timestampDisplay: (raw.timestamp_display || 'auto') as TimestampDisplay,
    weekStartsOn: raw.week_start === 'auto' ? detectWeekStart() : (weekDayMap[raw.week_start] ?? 1),
    numberFormat: raw.number_format === 'auto' ? detectNumberFormat() : raw.number_format as NumberFormat,
    units: raw.units === 'auto' ? detectUnits() : raw.units as 'metric' | 'imperial' | 'usa',
    timezone: raw.timezone === 'auto' ? detectTimezone() : raw.timezone,
  }
}

export function LocaleProvider({ children }: { children: React.ReactNode }) {
  const [raw, setRaw] = useState<LocalePreferences>(() => {
    const shellData = getShellInitData()
    return shellData?.locale ?? defaultRaw
  })

  // Listen for locale changes from the shell
  useEffect(() => {
    const unsub = onShellMessage((msg) => {
      if (msg.type === 'locale-change' && msg.locale) {
        setRaw(msg.locale as LocalePreferences)
      }
    })
    return () => unsub()
  }, [])

  const locale = useMemo(() => resolveLocale(raw), [raw])

  // Push the resolved locale into the i18n provider's module-level state so
  // custom Lingui formatters (mochiDate, mochiNumber, etc.) honour the user's
  // locale preferences.
  useEffect(() => {
    setActiveLocale({
      dateFormat: locale.dateFormat,
      timeFormat: locale.timeFormat,
      timestampDisplay: locale.timestampDisplay,
      numberFormat: locale.numberFormat,
    })
  }, [locale])

  return (
    <LocaleContext value={{ locale, raw }}>
      {children}
    </LocaleContext>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export function useLocale() {
  return useContext(LocaleContext)
}
