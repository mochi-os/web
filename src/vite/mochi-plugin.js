// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: Apache-2.0

// Mochi Vite plugin for common index.html transformations and locale filtering.

/**
 * @param {Object} options
 */
export function mochiPlugin(options = {}) {
  // BUILD_LOCALES=en builds only the `en` catalog; other locales resolve to an
  // empty stub module so Rollup never parses them. Unset builds every locale.
  const onlyEn = process.env.BUILD_LOCALES === 'en'
  const STUB_ID = '\0mochi-empty-locale'

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
