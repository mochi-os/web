// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: Apache-2.0

// User-preference label hooks: preference value to display text, resolved
// through the active Lingui catalog. Format keys that are already
// locale-neutral ('YYYY-MM-DD', '1,000.00') stay as their own display; the
// plain const exports below are English only.
import { useLingui } from '@lingui/react/macro'

/** Display labels for the appearance preference values. */
export function useAppearanceLabels(): Record<string, string> {
  const { t } = useLingui()
  return {
    light: t`Light`,
    dark: t`Dark`,
    auto: t`System`,
  }
}

export function useDateFormatLabels(): Record<string, string> {
  const { t } = useLingui()
  return {
    auto: t`Detect from web browser`,
    'YYYY-MM-DD': 'YYYY-MM-DD',
    'DD/MM/YYYY': 'DD/MM/YYYY',
    'DD.MM.YYYY': 'DD.MM.YYYY',
    'MM/DD/YYYY': 'MM/DD/YYYY',
    'D MMM YYYY': 'D MMM YYYY',
  }
}

export function useTimeFormatLabels(): Record<string, string> {
  const { t } = useLingui()
  return {
    auto: t`Detect from web browser`,
    '24h': t`24 hours`,
    '12h': t`12 hours`,
  }
}

export function useTimestampDisplayLabels(): Record<string, string> {
  const { t } = useLingui()
  return {
    auto: t`Relative within 24 hours, else absolute`,
    relative: t`Relative (5m, 3h, 2d)`,
    absolute: t`Absolute (date and time)`,
  }
}

export function useWeekStartLabels(): Record<string, string> {
  const { t } = useLingui()
  return {
    auto: t`Detect from web browser`,
    monday: t`Monday`,
    tuesday: t`Tuesday`,
    wednesday: t`Wednesday`,
    thursday: t`Thursday`,
    friday: t`Friday`,
    saturday: t`Saturday`,
    sunday: t`Sunday`,
  }
}

export function useNumberFormatLabels(): Record<string, string> {
  const { t } = useLingui()
  return {
    auto: t`Detect from web browser`,
    '1,000.00': '1,000.00',
    '1.000,00': '1.000,00',
    '1 000,00': '1 000,00',
    "1'000.00": "1'000.00",
    '1,00,000.00': '1,00,000.00',
  }
}

export function useUnitLabels(): Record<string, string> {
  const { t } = useLingui()
  return {
    auto: t`Detect from web browser`,
    metric: t`Metric`,
    imperial: t`Imperial`,
    usa: t`United States`,
  }
}

export function useDensityLabels(): Record<string, string> {
  const { t } = useLingui()
  return {
    theme: t`From theme`,
    compact: t`Compact`,
    comfortable: t`Comfortable`,
    spacious: t`Spacious`,
  }
}

export function useRadiusLabels(): Record<string, string> {
  const { t } = useLingui()
  return {
    theme: t`From theme`,
    '0rem': t`None`,
    '0.375rem': t`Small`,
    '0.75rem': t`Medium`,
    '1.75rem': t`Large`,
  }
}

export function useCardLabels(): Record<string, string> {
  const { t } = useLingui()
  return {
    theme: t`From theme`,
    flat: t`Flat`,
    raised: t`Raised`,
  }
}

export function useBackgroundLabels(): Record<string, string> {
  const { t } = useLingui()
  return {
    theme: t`From theme`,
    off: t`None`,
  }
}

export function useFontSizeLabels(): Record<string, string> {
  const { t } = useLingui()
  return {
    theme: t`From theme`,
    small: t`Small`,
    normal: t`Normal`,
    large: t`Large`,
    'extra-large': t`Extra large`,
  }
}

export function useFontLabels(): Record<string, string> {
  const { t } = useLingui()
  return {
    theme: t`From theme`,
    system: t`System`,
    serif: t`Serif`,
    dyslexia: t`Dyslexia-friendly`,
  }
}
