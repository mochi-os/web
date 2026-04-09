import { useLocale } from '../context/locale-provider'
import {
  formatDate,
  formatTime,
  formatDateTime,
  formatUserTimestamp,
  formatNumber,
} from '../lib/locale-format'

export function useFormat() {
  const { locale } = useLocale()
  return {
    formatDate: (date: Date) => formatDate(date, locale.dateFormat),
    formatTime: (date: Date) => formatTime(date, locale.timeFormat),
    formatDateTime: (date: Date) => formatDateTime(date, locale.dateFormat, locale.timeFormat),
    formatTimestamp: (ts: number, fallback?: string) => formatUserTimestamp(ts, locale, fallback),
    formatNumber: (value: number, decimals?: number) => formatNumber(value, locale.numberFormat, decimals),
    weekStartsOn: locale.weekStartsOn,
    units: locale.units,
  }
}
