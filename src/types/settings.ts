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
  border_radius?: string
  icon_mask?: string
  icon_background?: string
  background?: string
  overrides?: Record<string, string>
}

export interface PreferencesData {
  preferences: Record<string, string>
  schema: PreferenceSchema[]
  themes?: ThemeInfo[]
}
