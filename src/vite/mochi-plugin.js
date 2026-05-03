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

  return {
    name: 'mochi',
    enforce: 'pre',
    transformIndexHtml(html) {
      return html
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
