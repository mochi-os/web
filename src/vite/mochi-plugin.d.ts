// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: Apache-2.0

import type { Plugin, Rollup } from 'vite'

export interface MochiPluginOptions {
  /** Inject theme detection script (default: true) */
  theme?: boolean
  /**
   * Whether the app's pages load in the shell's frame (default: true). Its
   * bundle is then built as System.register modules for the inline loader,
   * which fetches it through the shell.
   */
  frame?: boolean
}

export function mochiPlugin(options?: MochiPluginOptions): Plugin

export type Manifest = [string[], Array<[number, number[]]>]

export function manifest(bundle: Rollup.OutputBundle, entry: string): Manifest

export function loaderScript(
  entry: string,
  manifest: Manifest,
  styles?: string[]
): Promise<string>
