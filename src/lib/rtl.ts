// Right-to-left locale detection for Mochi.
//
// Mochi sets `document.documentElement.dir` from the active language so
// Tailwind's logical properties (ms-, me-, ps-, pe-, text-start, text-end,
// etc.) flip appropriately. This file is the single source of truth for
// which locales render RTL.
//
// `en-x-pseudo-rtl` is a developer-facing pseudo-locale — its content stays
// English (no separate catalog needed; activation falls through to en) but
// the layout flips. To enable in a browser:
//
//   localStorage.setItem('mochi:language', 'en-x-pseudo-rtl')
//   location.reload()
//
// To revert:
//
//   localStorage.removeItem('mochi:language')
//   location.reload()

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
 * Returns true if the given BCP 47 tag should render right-to-left.
 * Matches the bare language subtag, so `ar-EG`, `he-il`, `fa-IR` all return true.
 * Also returns true for the `en-x-pseudo-rtl` developer pseudo-locale.
 */
export function isRtlLocale(lang: string | null | undefined): boolean {
  if (!lang) return false
  const tag = lang.toLowerCase()
  if (tag === 'en-x-pseudo-rtl') return true
  const base = tag.split('-')[0]
  return RTL_BASES.has(base)
}

/**
 * Set document.documentElement.dir based on the language. Idempotent — call
 * on every language change including initial load. Safe in SSR / non-browser
 * contexts (no-op when document is undefined).
 */
export function applyDocumentDir(lang: string | null | undefined): void {
  if (typeof document === 'undefined') return
  document.documentElement.dir = isRtlLocale(lang) ? 'rtl' : 'ltr'
}
