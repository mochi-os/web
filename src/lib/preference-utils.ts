/** Display labels for the appearance preference values. */
export const appearanceLabels: Record<string, string> = {
  light: 'Light',
  dark: 'Dark',
  auto: 'System',
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
