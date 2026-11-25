// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: Apache-2.0

import type { PluginOption, UserConfig } from 'vite'

export interface Options {
  /** The app's web directory: `@/` resolves to its src. */
  directory: string
  /** Where the built pages load their files from (default './'). */
  base?: string
  /** Whether the pages load in the shell's frame (default true). */
  frame?: boolean
  /** Whether the app routes with TanStack Router file routes (default true). */
  router?: boolean
  /** The app's own plugins, after the shared ones. */
  plugins?: PluginOption[]
}

export default function configuration(options: Options): UserConfig
