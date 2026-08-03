// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: Apache-2.0

// Mochi Vite plugin for common index.html transformations and locale filtering.

/**
 * @param {Object} options
 */
export function mochiPlugin(options = {}) {
  // BUILD_LOCALES=en makes the build skip every Lingui catalog except `en` —
  // referenced .po files for other locales are replaced with an empty catalog
  // module so Rollup never parses, transforms, or chunks them. Default
  // (unset / any other value) builds every locale referenced by main.tsx.
  // /build sets it for fast iteration; production deploys leave it unset.
  const onlyEn = process.env.BUILD_LOCALES === 'en'
  const STUB_ID = '\0mochi-empty-locale'

  // Fonts are no longer injected here. They used to arrive as a Google Fonts
  // <link> in every app's <head>, which disclosed every visitor's IP and this
  // server's origin to a third party on every page view. They are now
  // self-hosted @font-face declarations at the top of lib/web's theme.css,
  // which every app already imports — so they travel with the stylesheet
  // rather than needing an HTML transform, and the browser fetches only the
  // subsets and families it actually renders.

  return {
    name: 'mochi',
    enforce: 'pre',
    resolveId(source) {
      if (!onlyEn) return null
      const m = /(?:^|\/)locales\/([^/]+)\/messages\.po$/.exec(source)
      if (m && m[1] !== 'en') return STUB_ID
      return null
    },
    load(id) {
      if (id === STUB_ID) return 'export const messages = {}'
      return null
    },
  }
}
