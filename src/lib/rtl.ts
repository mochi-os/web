// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: Apache-2.0

// Right-to-left locale detection - the single source of truth for which locales
// render RTL. `en-x-pseudo-rtl` is a developer pseudo-locale: English content,
// flipped layout, enabled by setting localStorage 'mochi:language' and
// reloading.

const RTL_BASES = new Set([
  'ar',  // Arabic
  'he',  // Hebrew (modern)
  'iw',  // Hebrew (legacy ISO 639-1)
  'fa',  // Persian
  'ur',  // Urdu
  'ps',  // Pashto
  'sd',  // Sindhi
  'ku',  // Kurdish (Sorani)
  'ckb', // Central Kurdish
  'yi',  // Yiddish
  'dv',  // Dhivehi
])

/**
 * True when the tag renders right-to-left. Matched on the bare language subtag,
 * plus the `en-x-pseudo-rtl` pseudo-locale.
 */
export function isRtlLocale(lang: string | null | undefined): boolean {
  if (!lang) return false
  const tag = lang.toLowerCase()
  if (tag === 'en-x-pseudo-rtl') return true
  const base = tag.split('-')[0]
  return RTL_BASES.has(base)
}

/**
 * Set documentElement.dir and lang from the active language. Idempotent, and a
 * no-op outside a browser. `en-x-pseudo-rtl` maps down to `en` so screen
 * readers get a real tag.
 */
export function applyDocumentDir(lang: string | null | undefined): void {
  if (typeof document === 'undefined') return
  document.documentElement.dir = isRtlLocale(lang) ? 'rtl' : 'ltr'
  if (lang) {
    const tag = lang.toLowerCase()
    document.documentElement.lang = tag.startsWith('en-x-pseudo') ? 'en' : tag
  }
}
