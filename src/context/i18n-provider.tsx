// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: Apache-2.0

// Lingui i18n provider: activates each app's bundled PO catalog. The language
// comes from shell init data, else navigator.language. The full BCP 47 tag is
// kept end-to-end; variant trimming is the server-side resolver's job.
import { useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { i18n, type Messages } from '@lingui/core'
import { I18nProvider as LinguiProvider } from '@lingui/react'
import { getShellInitData, initShellBridge, onShellMessage } from '../lib/shell-bridge'
import { applyDocumentDir, isRtlLocale } from '../lib/rtl'
import { DirectionProvider as RdxDirProvider } from '@radix-ui/react-direction'
import {
  formatDate as fmtDate,
  formatTime as fmtTime,
  formatDateTime as fmtDateTime,
  formatNumber as fmtNumber,
  formatFileSize as fmtFileSize,
  formatUserTimestamp as fmtTimestamp,
  type NumberFormat,
  type ResolvedLocaleForTimestamp,
} from '../lib/locale-format'

export type CatalogLoader = () => Promise<{ messages: Messages }>
export type Catalogs = Record<string, CatalogLoader>

/** localStorage key for the anonymous-mode language preference. */
export const LANGUAGE_STORAGE_KEY = 'mochi:language'

// Module-level locale state used by the custom Lingui formatters. Updated
// by setActiveLocale() whenever LocaleProvider's locale changes. Lingui
// formatters are registered globally and have no React-context access, so
// they read this snapshot. Defaults match locale-provider's initial state.
type ActiveLocale = ResolvedLocaleForTimestamp & {
  numberFormat: NumberFormat
}

let activeLocale: ActiveLocale = {
  dateFormat: 'YYYY-MM-DD',
  timeFormat: '24h',
  numberFormat: '1,000.00',
  timestampDisplay: 'auto',
}

/**
 * Update the locale read by the custom Lingui formatters. Called by
 * LocaleProvider whenever the user's locale changes.
 */
export function setActiveLocale(locale: ActiveLocale): void {
  activeLocale = locale
}

// Register custom Lingui formatters once at module load. ICU MessageFormat
// uses these as `{value, mochiDate}`, `{ts, mochiTimestamp}`, etc. They
// delegate to lib/locale-format with the locale snapshot kept in
// activeLocale (see setActiveLocale).
function registerCustomFormatters(): void {
  i18n._ = i18n._.bind(i18n)
  // Lingui v5 doesn't expose a stable formatter-registration API, but
  // i18n.formats is read by the message compiler at activation time.
  // Custom formatters appear as functions on i18n.formats.<name>.
  type FormatFn = (value: unknown) => string
  const formats = (i18n as unknown as { formats?: Record<string, FormatFn> }).formats ?? {}
  formats.mochiDate = (v: unknown) => {
    const d = v instanceof Date ? v : new Date(v as string | number)
    return fmtDate(d, activeLocale.dateFormat, activeLocale.timezone)
  }
  formats.mochiTime = (v: unknown) => {
    const d = v instanceof Date ? v : new Date(v as string | number)
    return fmtTime(d, activeLocale.timeFormat, activeLocale.timezone)
  }
  formats.mochiDateTime = (v: unknown) => {
    const d = v instanceof Date ? v : new Date(v as string | number)
    return fmtDateTime(d, activeLocale.dateFormat, activeLocale.timeFormat, activeLocale.timezone)
  }
  formats.mochiNumber = (v: unknown) => {
    return fmtNumber(typeof v === 'number' ? v : Number(v), activeLocale.numberFormat)
  }
  formats.mochiFileSize = (v: unknown) => {
    return fmtFileSize(typeof v === 'number' ? v : Number(v), activeLocale.numberFormat)
  }
  formats.mochiTimestamp = (v: unknown) => {
    return fmtTimestamp(typeof v === 'number' ? v : Number(v), activeLocale)
  }
  ;(i18n as unknown as { formats: Record<string, FormatFn> }).formats = formats
}

registerCustomFormatters()

function readStoredLanguage(): string | null {
  try {
    return typeof localStorage !== 'undefined' ? localStorage.getItem(LANGUAGE_STORAGE_KEY) : null
  } catch {
    return null
  }
}

/**
 * Write the language preference to localStorage and a `mochi_language` cookie
 * (path=/). The cookie is what makes the server-side resolver honour a
 * pre-login choice after sign-in.
 *
 * This is the only client-side writer of that cookie, and it is reached only
 * from the top window: the picker on the login page has no session and so no
 * preference to save. Inside the shell iframe `document.cookie` is the
 * in-memory shim and this writes nothing — there the server sets the cookie
 * from /_/shell, which is why `language-set` no longer carries a cookie write.
 *
 * The one-year max-age is what we ask for, not what we get: Chrome caps cookie
 * lifetime at 400 days, and Safari's ITP caps script-written cookies at 7. An
 * anonymous language choice therefore lasts a week on Safari.
 */
export function setStoredLanguage(language: string): void {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(LANGUAGE_STORAGE_KEY, language)
    }
  } catch {
    /* sandboxed iframes have no storage; ignore */
  }
  try {
    if (typeof document !== 'undefined') {
      const oneYear = 60 * 60 * 24 * 365
      document.cookie = `mochi_language=${encodeURIComponent(language)}; path=/; max-age=${oneYear}; SameSite=Lax`
    }
  } catch {
    /* document not available in some environments; ignore */
  }
}

// Pseudo-locales recognised even when no catalog exists (en-x-pseudo-rtl
// flips document direction for RTL layout testing; activation falls through
// to en for content via resolveCatalogTag).
const PSEUDO_LOCALES = new Set(['en-x-pseudo-rtl', 'en-x-pseudo'])

function isAcceptedLocale(catalogs: Catalogs, language: string): boolean {
  return PSEUDO_LOCALES.has(language.toLowerCase()) || hasMatchingCatalog(catalogs, language)
}

function pickInitialLanguage(catalogs: Catalogs): string {
  // Priority: in-shell init data > localStorage > navigator > 'en'.
  // localStorage covers the login-page picker and anonymous-browsing chrome:
  // pre-login users pick a language, we reload, this fallback honours it.
  const shell = getShellInitData()
  if (shell?.language && isAcceptedLocale(catalogs, shell.language)) {
    return shell.language
  }
  const stored = readStoredLanguage()
  if (stored && isAcceptedLocale(catalogs, stored)) {
    return stored
  }
  if (typeof navigator !== 'undefined' && navigator.language) {
    if (isAcceptedLocale(catalogs, navigator.language)) {
      return navigator.language
    }
  }
  return 'en'
}

function hasMatchingCatalog(catalogs: Catalogs, language: string): boolean {
  // Exact match, then progressively shorter parent (en-GB -> en).
  let tag = language.toLowerCase()
  while (tag !== '') {
    if (Object.prototype.hasOwnProperty.call(catalogs, tag)) return true
    const i = tag.lastIndexOf('-')
    if (i < 0) return false
    tag = tag.slice(0, i)
  }
  return false
}

function resolveCatalogTag(catalogs: Catalogs, language: string): string {
  let tag = language.toLowerCase()
  while (tag !== '') {
    if (Object.prototype.hasOwnProperty.call(catalogs, tag)) return tag
    const i = tag.lastIndexOf('-')
    if (i < 0) break
    tag = tag.slice(0, i)
  }
  return 'en'
}

function isEmptyCatalog(messages: Messages): boolean {
  return Object.keys(messages).length === 0
}

/** Parent BCP 47 tag, or `en` for base locales, or null when exhausted. */
function parentCatalogTag(tag: string): string | null {
  const i = tag.lastIndexOf('-')
  if (i < 0) return tag === 'en' ? null : 'en'
  return tag.slice(0, i)
}

async function activate(catalogs: Catalogs, language: string): Promise<void> {
  let tag: string | null = resolveCatalogTag(catalogs, language)
  const tried = new Set<string>()

  while (tag && !tried.has(tag)) {
    tried.add(tag)
    const loader = catalogs[tag]
    if (!loader) {
      tag = parentCatalogTag(tag)
      continue
    }
    const { messages } = await loader()
    if (!isEmptyCatalog(messages)) {
      i18n.load(tag, messages)
      i18n.activate(tag)
      return
    }
    // BUILD_LOCALES=en stubs non-en catalogs with `{}` — walk to parent/en.
    tag = parentCatalogTag(tag)
  }

  // No non-empty catalog — Lingui falls back to message IDs.
  i18n.activate(language)
}

export function I18nProvider({
  children,
  catalogs,
  bootstrapFallback,
}: {
  children: React.ReactNode
  catalogs: Catalogs
  /** Shown while the first catalog loads. Defaults to a centered spinner. */
  bootstrapFallback?: React.ReactNode
}) {
  const [language, setLanguage] = useState(() => pickInitialLanguage(catalogs))
  const [ready, setReady] = useState(false)

  useEffect(() => {
    applyDocumentDir(language)
    let cancelled = false
    activate(catalogs, language).finally(() => {
      if (!cancelled) setReady(true)
    })
    return () => {
      cancelled = true
    }
  }, [catalogs, language])

  useEffect(() => {
    return onShellMessage((msg) => {
      if (msg.type === 'language-change' && typeof msg.language === 'string') {
        setLanguage(msg.language)
      }
    })
  }, [])

  // The server-driven language preference always wins on arrival: in-shell apps
  // get it from initShellBridge, top-window pages must call /_/shell
  // themselves. pickInitialLanguage() above can only see synchronous sources.
  useEffect(() => {
    let cancelled = false

    async function loadLanguage() {
      const shell = await initShellBridge()
      if (cancelled) return
      if (shell?.language && isAcceptedLocale(catalogs, shell.language)) {
        setLanguage(shell.language)
        return
      }
      // Top window — fetch /_/shell directly to learn the user preference.
      try {
        const res = await fetch('/_/shell', {
          method: 'POST',
          credentials: 'same-origin',
        })
        if (!res.ok) return
        const data = (await res.json()) as { language?: string }
        if (cancelled) return
        if (data.language && isAcceptedLocale(catalogs, data.language)) {
          setLanguage(data.language)
        }
      } catch {
        // Network error or anonymous request — leave whatever
        // pickInitialLanguage() already chose.
      }
    }

    void loadLanguage()
    return () => {
      cancelled = true
    }
  }, [catalogs])

  const dir = isRtlLocale(language) ? 'rtl' : 'ltr'

  if (!ready) {
    return (
      <RdxDirProvider dir={dir}>
        {bootstrapFallback ?? (
          <div
            className='text-muted-foreground flex min-h-[50vh] flex-col items-center justify-center gap-3'
            role='status'
            aria-busy='true'
            aria-live='polite'
          >
            <Loader2 className='size-6 animate-spin' />
          </div>
        )}
      </RdxDirProvider>
    )
  }

  return (
    <RdxDirProvider dir={dir}>
      <LinguiProvider i18n={i18n}>{children}</LinguiProvider>
    </RdxDirProvider>
  )
}
