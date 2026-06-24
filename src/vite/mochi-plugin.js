// Copyright © 2026 Mochi OÜ
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

  // Web fonts referenced by --font-sans / --font-mono and the user's
  // font preference. Injected into every app's <head> so iframe SPAs all
  // pick up the same fonts without each app's index.html duplicating the
  // tags. display=optional means the browser uses the webfont only if it's
  // ready within the short block period (already cached or arrives fast),
  // otherwise it keeps the fallback for the whole pageview and never swaps
  // mid-render — eliminating the flash between skeleton and loaded content.
  const FONT_LINKS = [
    '<link rel="preconnect" href="https://fonts.googleapis.com">',
    '<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>',
    '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600&family=Atkinson+Hyperlegible:ital,wght@0,400;0,700;1,400;1,700&display=optional">',
  ].join('\n    ')

  return {
    name: 'mochi',
    enforce: 'pre',
    transformIndexHtml(html) {
      // Skip if the app's index.html already loads its own fonts to
      // avoid duplicate <link> tags fetching the same stylesheet.
      if (/fonts\.googleapis\.com/.test(html)) return html
      return html.replace(/<\/head>/i, `    ${FONT_LINKS}\n  </head>`)
    },
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
