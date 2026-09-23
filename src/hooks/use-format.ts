// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: Apache-2.0

import { useMemo } from 'react'
import { i18n } from '@lingui/core'
import { useLocale } from '../context/locale-provider'
import {
  formatDate,
  formatTime,
  formatDateTime,
  formatUserTimestamp,
  formatNumber,
  formatFileSize,
  formatList,
  formatClock,
  formatHour,
  formatWeekday,
  formatWeekdayShort,
  formatWeekdayDay,
  formatMonthName,
  formatMonthYear,
  formatDayNumber,
  formatLongDate,
  formatDayRange,
  zonedDay,
  zonedMinutes,
  timestampAt,
} from '../lib/locale-format'

export function useFormat() {
  const { locale } = useLocale()
  // The list formatter follows the interface language, the rest the locale
  // preferences; the object is memoised so a formatter can sit in a
  // dependency list.
  const language = i18n.locale
  return useMemo(
    () => ({
      formatDate: (date: Date) =>
        formatDate(date, locale.dateFormat, locale.timezone),
      formatTime: (date: Date) =>
        formatTime(date, locale.timeFormat, locale.timezone),
      formatDateTime: (date: Date) =>
        formatDateTime(
          date,
          locale.dateFormat,
          locale.timeFormat,
          locale.timezone
        ),
      formatTimestamp: (ts: number, fallback?: string) =>
        formatUserTimestamp(ts, locale, fallback),
      formatNumber: (value: number, decimals?: number) =>
        formatNumber(value, locale.numberFormat, decimals),
      formatFileSize: (bytes: number) =>
        formatFileSize(bytes, locale.numberFormat),
      formatList: (
        items: string[],
        type: 'conjunction' | 'disjunction' = 'conjunction'
      ) => formatList(items, language, type),
      // Calendar formatting: whole days and clock readings in the user's own
      // zone, weekday and month names in the interface language. Where a
      // zone may be given it overrides the user's: an event's own, when the
      // calendar shows events in their zones; "" means the user's.
      formatClock: (date: Date, zone?: string) =>
        formatClock(date, locale.timeFormat, zone || locale.timezone),
      formatHour: (date: Date) =>
        formatHour(date, locale.timeFormat, locale.timezone),
      formatWeekday: (date: Date) => formatWeekday(date, locale.timezone),
      formatWeekdayShort: (date: Date) =>
        formatWeekdayShort(date, locale.timezone),
      formatWeekdayDay: (date: Date) => formatWeekdayDay(date, locale.timezone),
      formatMonthName: (date: Date) => formatMonthName(date, locale.timezone),
      formatMonthYear: (date: Date) => formatMonthYear(date, locale.timezone),
      formatDayNumber: (date: Date) => formatDayNumber(date, locale.timezone),
      formatLongDate: (date: Date, zone?: string) =>
        formatLongDate(date, zone || locale.timezone),
      formatDayRange: (from: Date, to: Date) =>
        formatDayRange(from, to, locale.timezone),
      zonedDay: (date: Date, zone?: string) =>
        zonedDay(date, zone || locale.timezone),
      zonedMinutes: (date: Date, zone?: string) =>
        zonedMinutes(date, zone || locale.timezone),
      timestampAt: (day: string, minutes: number, zone?: string) =>
        timestampAt(day, minutes, zone || locale.timezone),
      weekStartsOn: locale.weekStartsOn,
      timezone: locale.timezone,
      units: locale.units,
    }),
    [locale, language]
  )
}
