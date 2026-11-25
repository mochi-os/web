// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: Apache-2.0

import type { PluginOption } from 'vite'
import type { ViteUserConfig } from 'vitest/config'

export interface Options {
  /** The app's web directory: `@/` resolves to its src, and src/test/setup.ts
   * is run before the tests where it exists. */
  directory: string
  /** The environment the tests run in (default 'jsdom'). */
  environment?: 'jsdom' | 'node'
  /** The app's own plugins, after the shared ones. */
  plugins?: PluginOption[]
}

export default function configuration(options: Options): ViteUserConfig
