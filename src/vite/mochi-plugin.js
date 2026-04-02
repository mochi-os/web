// Mochi Vite plugin for common index.html transformations

/**
 * @param {Object} options
 */
export function mochiPlugin(options = {}) {
  return {
    name: 'mochi',
    transformIndexHtml(html) {
      return html
    },
  }
}
