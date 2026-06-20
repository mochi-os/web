// Copyright © 2026 Mochi OÜ
// SPDX-License-Identifier: Apache-2.0

import type { Plugin } from 'vite'

export interface MochiPluginOptions {
  /** Inject theme detection script (default: true) */
  theme?: boolean
}

export function mochiPlugin(options?: MochiPluginOptions): Plugin
