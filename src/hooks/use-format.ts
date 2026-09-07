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
} from '../lib/locale-format'

export function useFormat() {
  const { locale } = useLocale()
  // The list formatter follows the interface language, the rest the locale
  // preferences; the object is memoised so a formatter can sit in a
  // dependency list.
  const language = i18n.locale
  return useMemo(
    () => ({
      formatDate: (date: Date) => formatDate(date, locale.dateFormat, locale.timezone),
      formatTime: (date: Date) => formatTime(date, locale.timeFormat, locale.timezone),
      formatDateTime: (date: Date) => formatDateTime(date, locale.dateFormat, locale.timeFormat, locale.timezone),
      formatTimestamp: (ts: number, fallback?: string) => formatUserTimestamp(ts, locale, fallback),
      formatNumber: (value: number, decimals?: number) => formatNumber(value, locale.numberFormat, decimals),
      formatFileSize: (bytes: number) => formatFileSize(bytes, locale.numberFormat),
      formatList: (items: string[], type: 'conjunction' | 'disjunction' = 'conjunction') =>
        formatList(items, language, type),
      weekStartsOn: locale.weekStartsOn,
      units: locale.units,
    }),
    [locale, language],
  )
}
