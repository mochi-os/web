// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: Apache-2.0

export interface SystemSetting {
  name: string
  value: string
  default: string
  description: string
  pattern: string
  user_readable: boolean
  read_only: boolean
  public: boolean
  // True when the value is a credential the server never returns. For such
  // settings `value` is always "" and `set` reports whether one is stored.
  secret?: boolean
  set?: boolean
}

export interface SystemSettingsData {
  settings: SystemSetting[]
  /** Local libp2p peer ID and its fingerprint, shown on the System Status
   * page so the operator can copy them. */
  server?: { id: string; fingerprint?: string }
}

export interface ThemeInfo {
  id: string
  app: string
  label: string
  hue: number
  chroma: number
  hue_bg: number
  border_radius?: string
  spacing?: string
  font_sans?: string
  font_mono?: string
  icon_mask?: string
  icon_background?: string
  background?: string
  overrides?: Record<string, string>
  development?: boolean
}

export interface PreferencesData {
  preferences: Record<string, string>
  themes?: ThemeInfo[]
  // Per-density CSS-var bundles emitted by mochi.app.presets().
  // Keyed by "compact" / "comfortable" / "spacious"; each value maps
  // every CSS custom property the preset defines to its computed value.
  presets?: Record<string, Record<string, string>>
}
