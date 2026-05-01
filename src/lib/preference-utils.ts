// User-preference label hooks. Each returns a Record<string, string> mapping
// preference values to their human-readable display, with translatable strings
// resolved through Lingui's active catalog. Number/date/time format keys that
// are already locale-neutral (e.g. 'YYYY-MM-DD', '1,000.00') stay as their
// own display.
//
// Use the hook variant inside React components. The plain const exports below
// remain for any non-React or pre-i18n consumers, but they are English only —
// new code should prefer the hook.
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

export function useStylePresetLabels(): Record<string, string> {
  const { t } = useLingui()
  return {
    default: t`Luma (Default)`,
    vega: 'Vega',
    nova: 'Nova',
    maia: 'Maia',
    lyra: 'Lyra',
    mira: 'Mira',
    luma: 'Luma',
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

// English-only fallback consts for any pre-existing consumer that runs
// outside a React tree. Keep in sync with the hooks above.
export const appearanceLabels: Record<string, string> = {
  light: 'Light',
  dark: 'Dark',
  auto: 'System',
}

export const stylePresetLabels: Record<string, string> = {
  default: 'Luma (Default)',
  vega: 'Vega',
  nova: 'Nova',
  maia: 'Maia',
  lyra: 'Lyra',
  mira: 'Mira',
  luma: 'Luma',
}

export const dateFormatLabels: Record<string, string> = {
  auto: 'Detect from web browser',
  'YYYY-MM-DD': 'YYYY-MM-DD',
  'DD/MM/YYYY': 'DD/MM/YYYY',
  'DD.MM.YYYY': 'DD.MM.YYYY',
  'MM/DD/YYYY': 'MM/DD/YYYY',
  'D MMM YYYY': 'D MMM YYYY',
}

export const timeFormatLabels: Record<string, string> = {
  auto: 'Detect from web browser',
  '24h': '24 hours',
  '12h': '12 hours',
}

export const timestampDisplayLabels: Record<string, string> = {
  auto: 'Relative within 24 hours, else absolute',
  relative: 'Relative (5m, 3h, 2d)',
  absolute: 'Absolute (date and time)',
}

export const weekStartLabels: Record<string, string> = {
  auto: 'Detect from web browser',
  monday: 'Monday',
  tuesday: 'Tuesday',
  wednesday: 'Wednesday',
  thursday: 'Thursday',
  friday: 'Friday',
  saturday: 'Saturday',
  sunday: 'Sunday',
}

export const numberFormatLabels: Record<string, string> = {
  auto: 'Detect from web browser',
  '1,000.00': '1,000.00',
  '1.000,00': '1.000,00',
  '1 000,00': '1 000,00',
  "1'000.00": "1'000.00",
  '1,00,000.00': '1,00,000.00',
}

export const unitLabels: Record<string, string> = {
  auto: 'Detect from web browser',
  metric: 'Metric',
  imperial: 'Imperial',
  usa: 'United States',
}
