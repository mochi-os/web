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
  /**
   * Whether a framed app takes React from fixed System.register files in its
   * assets' shared/ folder rather than bundling it (default: true). false
   * bundles React into the app, as before.
   */
  shared?: boolean
}

export function mochiPlugin(options?: MochiPluginOptions): Plugin

export type Manifest = [string[], Array<[number, number[]]>]

/** React's shared files in the bundle's terms: see manifest(). */
export interface SharedFiles {
  names: Record<string, string>
  imports: Record<string, string[]>
}

export function manifest(
  bundle: Rollup.OutputBundle,
  entry: string,
  shared?: SharedFiles
): Manifest

export function loaderScript(
  entry: string,
  manifest: Manifest,
  styles?: string[],
  names?: Record<string, string>
): Promise<string>

/**
 * Drops each font's WOFF file where its WOFF2 is offered beside it, from the
 * stylesheets' src lists and from the bundle.
 */
export function woffDrop(bundle: Record<string, unknown>): void
