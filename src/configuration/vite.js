// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: Apache-2.0

// An app's Vite configuration: each app's vite.config.ts is a call to this with
// what is its own.

import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { lingui } from '@lingui/vite-plugin'
import tailwindcss from '@tailwindcss/vite'
import { tanstackRouter } from '@tanstack/router-plugin/vite'
import react from '@vitejs/plugin-react-swc'
import { mochiPlugin } from '../vite/mochi-plugin.js'

// jiti is Node-only, pulled in through @lingui/conf. Vite before Node 20.19
// leaks it into the browser bundle, where its node:module import fails.
const empty = fileURLToPath(new URL('./empty.js', import.meta.url))

/**
 * @param {import('./vite').Options} options
 * @returns {import('vite').UserConfig}
 */
export default function configuration({
  directory,
  base = './',
  frame = true,
  shared,
  router = true,
  plugins = [],
}) {
  return {
    base,
    plugins: [
      mochiPlugin({ frame, shared }),
      ...(router
        ? [tanstackRouter({ target: 'react', autoCodeSplitting: true })]
        : []),
      react({ plugins: [['@lingui/swc-plugin', {}]] }),
      lingui(),
      tailwindcss(),
      ...plugins,
    ],
    resolve: {
      alias: [
        { find: '@', replacement: path.resolve(directory, 'src') },
        { find: /^jiti(\/.*)?$/, replacement: empty },
      ],
      // One copy of each package that holds React context, whichever package
      // imports it: the app's own or @mochi/web. Deduping resolves from the
      // app, so the router only where the app routes with it.
      dedupe: [
        'react',
        'react-dom',
        '@tanstack/react-query',
        ...(router ? ['@tanstack/react-router'] : []),
      ],
    },
  }
}
