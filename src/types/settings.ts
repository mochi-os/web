export interface SystemSetting {
  name: string
  value: string
  default: string
  description: string
  pattern: string
  user_readable: boolean
  read_only: boolean
  public: boolean
}

export interface SystemSettingsData {
  settings: SystemSetting[]
}

export interface PreferenceSchema {
  key: string
  type: 'select' | 'timezone'
  options?: string[]
  default: string
  label: string
  description: string
}

export interface ThemeInfo {
  id: string
  app: string
  label: string
  hue: number
  chroma: number
  hue_bg: number
  preview: string
  preview_dark?: string
  border_radius?: string
  spacing?: string
  font_sans?: string
  font_mono?: string
  icon_mask?: string
  icon_background?: string
  background?: string
  background_url?: string
  overrides?: Record<string, string>
  development?: boolean
}

export interface PreferencesData {
  preferences: Record<string, string>
  schema: PreferenceSchema[]
  themes?: ThemeInfo[]
  // Per-density CSS-var bundles emitted by mochi.app.theme_presets().
  // Keyed by "compact" / "comfortable" / "spacious"; each value maps
  // every CSS custom property the preset defines to its computed value.
  presets?: Record<string, Record<string, string>>
}
