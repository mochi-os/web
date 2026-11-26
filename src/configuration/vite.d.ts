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
  /**
   * Whether the build emits React's shared files (default: true in the frame,
   * where the app takes React from them; false outside it, true only for the
   * page that hosts them for every app, menu).
   */
  shared?: boolean
  /** Whether the app routes with TanStack Router file routes (default true). */
  router?: boolean
  /** The app's own plugins, after the shared ones. */
  plugins?: PluginOption[]
}

export default function configuration(options: Options): UserConfig
