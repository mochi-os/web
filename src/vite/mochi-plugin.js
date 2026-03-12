// Mochi Vite plugin - injects common scripts and meta tags into index.html

// Theme detection script - runs before CSS loads to prevent flash
const themeScript = `
(function() {
  var theme = document.cookie.match(/mochi-theme=([^;]+)/);
  theme = theme ? theme[1] : 'light';
  if (theme === 'system') {
    theme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  if (theme === 'dark') {
    document.documentElement.classList.add('dark');
  }
})();
`.trim()

/**
 * Mochi Vite plugin for common index.html transformations
 * @param {Object} options
 * @param {boolean} [options.theme=true] - Inject theme detection script
 */
export function mochiPlugin(options = {}) {
  const { theme = true } = options

  return {
    name: 'mochi',
    transformIndexHtml(html) {
      const headInjections = []

      if (theme) {
        headInjections.push(`<script>${themeScript}</script>`)
      }

      // Inject at start of <head>
      if (headInjections.length > 0) {
        html = html.replace('<head>', '<head>\n    ' + headInjections.join('\n    '))
      }

      return html
    },
  }
}
