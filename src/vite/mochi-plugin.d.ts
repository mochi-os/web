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
   * Whether the build emits React as fixed System.register files in its
   * assets' shared/ folder. A framed app then takes React from them rather
   * than bundling it, from menu's copy where that is the same bytes (default:
   * true; false bundles React into the app, as before). A page that never
   * loads in the frame only hosts them for the apps (default: false).
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
  shared?: {
    names: Record<string, string>
    files: Record<string, string>
    menu: string
  }
): Promise<string>

/**
 * Drops each font's WOFF file where its WOFF2 is offered beside it, from the
 * stylesheets' src lists and from the bundle.
 */
export function woffDrop(bundle: Record<string, unknown>): void
