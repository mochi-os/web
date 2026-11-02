// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: Apache-2.0

// Mochi Vite plugin for common index.html transformations and locale filtering.

import path from 'node:path'
import { transformWithEsbuild } from 'vite'
import { loader } from './loader.js'

// The entry module script and the stylesheets Vite writes into the built page.
const entryScript = /<script type="module"[^>]*\ssrc="([^"]+)"[^>]*><\/script>/
const stylesheet = /<link rel="stylesheet"[^>]*\shref="([^"]+)"[^>]*>\s*/g

/**
 * For each chunk that statically imports others, every chunk it imports,
 * directly or not: [files, imports], files the paths relative to the entry's
 * directory and imports a list of [chunk, [dependencies]] as indices into
 * files. The page carries it, so it is kept small.
 */
export function manifest(bundle, entry) {
  const imports = new Map()
  for (const item of Object.values(bundle)) {
    if (item.type === 'chunk') imports.set(item.fileName, item.imports)
  }
  const directory = path.posix.dirname(entry)
  const files = []
  const index = new Map()
  const number = (file) => {
    if (!index.has(file)) {
      index.set(file, files.length)
      files.push(path.posix.relative(directory, file))
    }
    return index.get(file)
  }
  const result = []
  for (const name of [...imports.keys()].sort()) {
    const closure = new Set()
    const stack = [...imports.get(name)]
    while (stack.length > 0) {
      const next = stack.pop()
      if (closure.has(next) || next === name) continue
      closure.add(next)
      stack.push(...(imports.get(next) ?? []))
    }
    if (closure.size === 0) continue
    result.push([number(name), [...closure].sort().map(number)])
  }
  return [files, result]
}

/**
 * The page's inline loader script, in place of the module script that would
 * load the entry.
 */
export async function loaderScript(entrySource, map, styles = []) {
  const call = `(${loader.toString()})(${JSON.stringify(map)}, ${JSON.stringify(entrySource)}, ${JSON.stringify(styles)})`
  const minified = await transformWithEsbuild(call, 'loader.js', {
    minify: true,
    target: 'es2020',
  })
  return `<script>${minified.code.trim()}</script>`
}

/**
 * @param {Object} options
 * @param {boolean} [options.frame] Whether the app's pages load in the
 *   shell's frame (default true). Its bundle is then built as System.register
 *   modules and loaded by the inline loader, which fetches it through the
 *   shell (see loader.js). The menu, which is the shell page itself, and the
 *   sign-in page, which never loads in the frame, keep native modules.
 */
export function mochiPlugin(options = {}) {
  // BUILD_LOCALES=en builds only the `en` catalog; other locales resolve to an
  // empty stub module so Rollup never parses them. Unset builds every locale.
  const onlyEn = process.env.BUILD_LOCALES === 'en'
  const STUB_ID = '\0mochi-empty-locale'
  const frame = options.frame !== false
  let building = false

  return {
    name: 'mochi',
    enforce: 'pre',
    config(_config, environment) {
      building = frame && environment.command === 'build'
      if (!building) return null
      return {
        build: {
          // No modulepreload links or polyfill: they would fetch the chunks
          // as native modules, outside the loader and the shell's cache.
          modulePreload: false,
          // One stylesheet the loader puts in place before the app runs,
          // rather than styles each chunk injects as it executes: a page
          // painted unstyled until its code had loaded.
          cssCodeSplit: false,
          rollupOptions: { output: { format: 'system' } },
        },
      }
    },
    resolveId(source) {
      if (!onlyEn) return null
      const m = /(?:^|\/)locales\/([^/]+)\/messages\.po$/.exec(source)
      if (m && m[1] !== 'en') return STUB_ID
      return null
    },
    load(id) {
      if (id === STUB_ID) return 'export const messages = {}'
      return null
    },
    transformIndexHtml: {
      order: 'post',
      async handler(html, context) {
        if (!building || !context.bundle || !context.chunk) return html
        const found = entryScript.exec(html)
        if (!found) {
          throw new Error(
            'mochi: the built page has no entry module script to replace'
          )
        }
        const styles = [...html.matchAll(stylesheet)].map((match) => match[1])
        const script = await loaderScript(
          found[1],
          manifest(context.bundle, context.chunk.fileName),
          styles
        )
        return html.replace(stylesheet, '').replace(found[0], () => script)
      },
    },
  }
}
