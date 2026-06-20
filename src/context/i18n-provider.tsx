// Copyright © 2026 Mochi OÜ
// SPDX-License-Identifier: Apache-2.0

// Lingui i18n provider for Mochi apps.
//
// Activates a per-language Lingui catalog using bundled PO files from each
// app's src/locales/<lang>/messages.po (compiled on the fly by
// @lingui/vite-plugin). Catalog selection follows:
//   1. shell init data (`language` field) — from the user's preference or
//      Accept-Language; piped via the menu shell's postMessage init.
//   2. navigator.language as a final fallback for top-window apps.
// The full BCP 47 tag is preserved end-to-end (no .split('-')[0]); variant
// trimming is handled by the server-side resolver's fallback chain.
//
// To use, wrap the app's root with <I18nProvider catalogs={catalogs}> where
// catalogs is a record of locale -> dynamic-import factory:
//
//   const catalogs = {
//     en: () => import('./locales/en/messages.po'),
//     fr: () => import('./locales/fr/messages.po'),
//   }
//
// Custom formatters: mochiDate, mochiTime, mochiDateTime, mochiNumber,
// mochiFileSize, mochiTimestamp. Used inside ICU MessageFormat as
// `{value, mochiDate}` etc. They delegate to format helpers via the active
// locale set by LocaleProvider — see registerLocaleFormatters() below.
import { useEffect, useState } from 'react'
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
 * Update the locale read by custom Lingui formatters (mochiDate, mochiNumber,
 * etc.). Called by LocaleProvider whenever the user's locale changes; the
 * next render of any <Trans>/t`` containing a custom formatter will use the
 * new locale's date/number conventions.
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
    return fmtDate(d, activeLocale.dateFormat)
  }
  formats.mochiTime = (v: unknown) => {
    const d = v instanceof Date ? v : new Date(v as string | number)
    return fmtTime(d, activeLocale.timeFormat)
  }
  formats.mochiDateTime = (v: unknown) => {
    const d = v instanceof Date ? v : new Date(v as string | number)
    return fmtDateTime(d, activeLocale.dateFormat, activeLocale.timeFormat)
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
 * Write the language preference to localStorage AND a `mochi_language` cookie.
 * Called by the login page and anonymous-chrome pickers; in-shell apps use
 * shellSetLanguage instead, which persists via the menu shell + the user's
 * server-side preference.
 *
 * The cookie lets the server-side language resolver (request_language in
 * core/server/labels.go) honour the choice for both anonymous traffic and the
 * logged-in transition: without it, /_/shell would fall through to
 * Accept-Language after sign-in and the user's pre-login pick would be lost.
 * The cookie is path=/ so it covers every Mochi app and outlives the session.
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

async function activate(catalogs: Catalogs, language: string): Promise<void> {
  const tag = resolveCatalogTag(catalogs, language)
  const loader = catalogs[tag]
  if (!loader) {
    // No catalog at all — Lingui falls back to source IDs.
    i18n.activate(language)
    return
  }
  const { messages } = await loader()
  i18n.load(tag, messages)
  i18n.activate(tag)
}

export function I18nProvider({
  children,
  catalogs,
}: {
  children: React.ReactNode
  catalogs: Catalogs
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

  // Fetch the user's language preference from the server.
  //
  // Two paths converge here:
  // - In-shell apps: shell.js fetches /_/shell once and forwards the
  //   language to each iframe via postMessage. initShellBridge() resolves
  //   with the forwarded data.
  // - Top-window apps (e.g. /settings/, /login/ landing): no shell, so we
  //   call /_/shell directly. The endpoint returns the user's `language`
  //   preference (or Accept-Language for anonymous requests).
  //
  // pickInitialLanguage() runs synchronously during useState init and can
  // only see synchronous sources (localStorage, navigator.language). The
  // server-driven preference always wins on arrival.
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

  if (!ready) return null
  const dir = isRtlLocale(language) ? 'rtl' : 'ltr'
  return (
    <RdxDirProvider dir={dir}>
      <LinguiProvider i18n={i18n}>{children}</LinguiProvider>
    </RdxDirProvider>
  )
}
