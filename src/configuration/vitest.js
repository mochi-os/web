// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: Apache-2.0

// An app's Vitest configuration: each app's vitest.config.ts is a call to this
// with what is its own.

import fs from 'node:fs'
import path from 'node:path'
import react from '@vitejs/plugin-react-swc'

/**
 * @param {import('./vitest').Options} options
 * @returns {import('vitest/config').ViteUserConfig}
 */
export default function configuration({
  directory,
  environment = 'jsdom',
  plugins = [],
}) {
  const setup = path.join(directory, 'src/test/setup.ts')
  return {
    // The build's Lingui macro transform: without it @lingui/*/macro falls
    // through to babel-plugin-macros, which is not installed.
    plugins: [react({ plugins: [['@lingui/swc-plugin', {}]] }), ...plugins],
    resolve: {
      alias: { '@': path.resolve(directory, 'src') },
    },
    test: {
      environment,
      globals: true,
      setupFiles: fs.existsSync(setup) ? [setup] : [],
      include: ['src/**/*.{test,spec}.{ts,tsx}'],
      coverage: {
        provider: 'v8',
        reporter: ['text', 'json', 'html'],
        include: ['src/**/*.{ts,tsx}'],
        exclude: [
          'src/test/**',
          'src/**/*.d.ts',
          'src/routeTree.gen.ts',
          'src/main.tsx',
          'src/vite-env.d.ts',
        ],
      },
    },
  }
}
