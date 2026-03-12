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

export interface PreferencesData {
  preferences: Record<string, string>
  schema: PreferenceSchema[]
}
