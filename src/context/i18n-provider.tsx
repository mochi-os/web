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
// TODO: register custom Lingui formatters (mochiDate, mochiNumber, etc.) that
// delegate to useFormat() — Phase 1 step 21. Until then, label authors should
// pre-format dates/numbers via useFormat() before passing into <Trans>.
import { useEffect, useState } from 'react'
import { i18n, type Messages } from '@lingui/core'
import { I18nProvider as LinguiProvider } from '@lingui/react'
import { getShellInitData, onShellMessage } from '../lib/shell-bridge'

export type CatalogLoader = () => Promise<{ messages: Messages }>
export type Catalogs = Record<string, CatalogLoader>

function pickInitialLanguage(catalogs: Catalogs): string {
  const shell = getShellInitData()
  if (shell?.language && hasMatchingCatalog(catalogs, shell.language)) {
    return shell.language
  }
  if (typeof navigator !== 'undefined' && navigator.language) {
    if (hasMatchingCatalog(catalogs, navigator.language)) {
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

  if (!ready) return null
  return <LinguiProvider i18n={i18n}>{children}</LinguiProvider>
}
