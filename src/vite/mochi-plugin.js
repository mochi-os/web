// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: Apache-2.0

// Mochi Vite plugin for common index.html transformations and locale filtering.

import { createHash } from 'node:crypto'
import path from 'node:path'
import { transformWithEsbuild } from 'vite'
import { loader } from './loader.js'
import { bundlesReact, isReact, sharedReact } from './shared-react.js'

// The entry module script and the stylesheets Vite writes into the built page.
const entryScript = /<script type="module"[^>]*\ssrc="([^"]+)"[^>]*><\/script>/
const stylesheet = /<link rel="stylesheet"[^>]*\shref="([^"]+)"[^>]*>\s*/g

/**
 * For each chunk that statically imports others, every chunk it imports,
 * directly or not: [files, imports], files the paths relative to the entry's
 * directory and imports a list of [chunk, [dependencies]] as indices into
 * files. The page carries it, so it is kept small.
 *
 * shared, where the build left React to the shared files, is { names,
 * imports }: names each bare name's file, imports each shared file's own
 * static imports, every path in the bundle's terms. A chunk importing React is
 * then taken to import its shared file, so that file is asked for with the
 * chunk rather than once the chunk has been read.
 */
export function manifest(bundle, entry, shared) {
  const names = shared?.names ?? {}
  const imports = new Map(Object.entries(shared?.imports ?? {}))
  for (const item of Object.values(bundle)) {
    if (item.type === 'chunk') {
      imports.set(
        item.fileName,
        item.imports.map((id) => names[id] ?? id)
      )
    }
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

// Rollup's external: React, and whatever the app leaves out itself, as
// Rollup reads an id, a pattern or a list of either, or a function.
function externals(theirs) {
  if (theirs === undefined || theirs === null) return isReact
  const listed =
    typeof theirs === 'function'
      ? theirs
      : (id) =>
          [theirs]
            .flat()
            .some((item) =>
              item instanceof RegExp ? item.test(id) : item === id
            )
  return (id, parent, resolved) =>
    isReact(id) || Boolean(listed(id, parent, resolved))
}

// Where every app looks for the shared files first: menu's own copy, which
// the shell carries to any app's frame (shell.js), so the browser keeps them
// once for every app. Exported for menu's tests, which hold it, the folder
// menu's build emits into and the shell's rule (SHARED_FILE) to one another.
export const MENU_SHARED = '/menu/assets/shared/'

/**
 * The page's inline loader script, in place of the module script that would
 * load the entry. shared, where the build left React external, is { names,
 * files, menu } as loader.js reads it.
 */
export async function loaderScript(entrySource, map, styles = [], shared) {
  const call = `(${loader.toString()})(${JSON.stringify(map)}, ${JSON.stringify(entrySource)}, ${JSON.stringify(styles)}, ${JSON.stringify(shared ?? null)})`
  const minified = await transformWithEsbuild(call, 'loader.js', {
    minify: true,
    target: 'es2020',
  })
  return `<script>${minified.code.trim()}</script>`
}

// A src declaration and its list, a url() - which a data URI's ';' may sit
// inside - read whole.
const fontSources = /(^|[{;\s])src:((?:url\([^)]*\)|[^;}])*)/g

/**
 * Drops each font's WOFF copy where its WOFF2 sits beside it. A font face's
 * src list that offers both is served WOFF2 by every browser that can show the
 * pages, so the WOFF was never fetched, yet the fontsource stylesheets the
 * theme imports name both, and every app zip carried 23 of them (0.22 MB). A
 * list with WOFF alone keeps it, as does a WOFF inlined as a data: address,
 * which is no file. A WOFF file left named nowhere in the bundle is removed
 * from it.
 */
// The entries of a src list, split at its own commas: one inside a url(), a
// format() or a quoted string is part of the entry.
function sourceEntries(list) {
  const entries = []
  let depth = 0
  let quote = ''
  let start = 0
  for (let i = 0; i < list.length; i++) {
    const c = list[i]
    if (quote) {
      if (c === quote) quote = ''
    } else if (c === '"' || c === "'") {
      quote = c
    } else if (c === '(') {
      depth++
    } else if (c === ')') {
      depth--
    } else if (c === ',' && depth === 0) {
      entries.push(list.slice(start, i))
      start = i + 1
    }
  }
  entries.push(list.slice(start))
  return entries
}

// An entry's format(), or '' where it names none.
function sourceFormat(entry) {
  return /format\(\s*["']?([\w-]+)["']?\s*\)/.exec(entry)?.[1] ?? ''
}

// An entry's file: its url(), unless that is inlined as a data: address,
// which is no file in the zip.
function sourceFile(entry) {
  const url = /url\(\s*["']?([^"')]*)/.exec(entry)?.[1] ?? ''
  return url && !url.startsWith('data:') ? url : ''
}

export function woffDrop(bundle) {
  const dropped = new Set()
  for (const item of Object.values(bundle)) {
    if (item.type !== 'asset' || !item.fileName.endsWith('.css')) continue
    const css = String(item.source)
    item.source = css.replace(fontSources, (declaration, before, list) => {
      const entries = sourceEntries(list)
      if (!entries.some((entry) => sourceFormat(entry) === 'woff2')) {
        return declaration
      }
      // Only a WOFF file goes; every other entry - local(), a url() naming
      // no format, one inlined - stays as it was written.
      const woff = (entry) =>
        sourceFormat(entry) === 'woff' && sourceFile(entry) !== ''
      const kept = entries.filter((entry) => !woff(entry))
      if (kept.length === entries.length) return declaration
      for (const entry of entries) {
        if (!woff(entry)) continue
        // By its file name, which the build hashes: the URL is relative to
        // the stylesheet under base './', and absolute under an app's own.
        dropped.add(path.posix.basename(sourceFile(entry).split(/[?#]/)[0]))
      }
      return before + 'src:' + kept.join(',')
    })
  }
  for (const name of dropped) {
    const file = Object.keys(bundle).find(
      (key) => path.posix.basename(key) === name
    )
    if (!file) continue
    const named = Object.values(bundle).some((item) => {
      if (item.fileName === file) return false
      const text = item.type === 'chunk' ? item.code : item.source
      return typeof text === 'string' && text.includes(name)
    })
    if (!named) delete bundle[file]
  }
}

/**
 * @param {Object} options
 * @param {boolean} [options.frame] Whether the app's pages load in the
 *   shell's frame (default true). Its bundle is then built as System.register
 *   modules and loaded by the inline loader, which fetches it through the
 *   shell (see loader.js). The menu, which is the shell page itself, and the
 *   sign-in page, which never loads in the frame, keep native modules.
 * @param {boolean} [options.shared] Whether the build emits React as fixed
 *   files in its assets' shared/ folder (see shared-react.js). A framed app
 *   then takes React from them rather than bundling it, from menu's copy where
 *   that is the same bytes; default true, and false bundles React into the
 *   app, as before. A page that never loads in the frame only hosts them for
 *   the apps: the menu does, with true; default false.
 */
export function mochiPlugin(options = {}) {
  // BUILD_LOCALES=en builds only the `en` catalog; other locales resolve to an
  // empty stub module so Rollup never parses them. Unset builds every locale.
  const onlyEn = process.env.BUILD_LOCALES === 'en'
  const STUB_ID = '\0mochi-empty-locale'
  const frame = options.frame !== false
  const shared = frame ? options.shared !== false : options.shared === true
  let building = false
  let emitting = false
  let root = ''
  let assetsDir = 'assets'
  let react = null // Promise of React's shared files, or of null
  let failed = false // whether that promise rejected

  // The shared files in the bundle's terms: each bare name's file and each
  // file's own imports, under the assets' shared/ folder.
  const inBundle = (file) => path.posix.join(assetsDir, 'shared', file)
  function bundled(built) {
    const names = {}
    for (const [name, file] of Object.entries(built.names)) {
      names[name] = inBundle(file)
    }
    const imports = {}
    for (const file of built.files) {
      imports[inBundle(file.fileName)] = file.imports.map(inBundle)
    }
    return { names, imports }
  }

  return {
    name: 'mochi',
    enforce: 'pre',
    config(_config, environment) {
      building = frame && environment.command === 'build'
      emitting = shared && environment.command === 'build'
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
    // React comes from the shared files, as each chunk imports it. Set on
    // Rollup's own options, where the app's external is already in place to
    // keep: config() would have Vite replace an app's function with this one,
    // or put it in an app's list, where Rollup takes a function for an id.
    options(rollup) {
      if (!building || !shared) return null
      return { ...rollup, external: externals(rollup.external) }
    },
    configResolved(config) {
      root = config.root
      assetsDir = config.build.assetsDir
    },
    // Built while the app is, and once per run of the build.
    buildStart() {
      // Built again only after a failure: in watch mode a passing failure
      // would otherwise fail every rebuild after it.
      if (!emitting || (react && !failed)) return
      failed = false
      react = sharedReact(root)
      // Awaited in generateBundle; this keeps a failure from being reported
      // as unhandled before then.
      react.catch(() => {
        failed = true
      })
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
    // After every other plugin's: the stylesheet is emitted by Vite's own
    // CSS plugin in this same hook, and is not in the bundle before it.
    generateBundle: {
      order: 'post',
      async handler(_options, bundle) {
        woffDrop(bundle)
        const built = react && (await react)
        if (building && shared) {
          for (const item of Object.values(bundle)) {
            if (item.type !== 'chunk') continue
            // A name with no shared file would be asked for beside the chunk
            // as a file of its own, which is not there.
            for (const id of [...item.imports, ...item.dynamicImports]) {
              if (isReact(id) && !built?.names[id]) {
                this.error(
                  built
                    ? `${item.fileName} imports ${id}, which has no shared file`
                    : `${item.fileName} imports ${id}, but React is not installed ` +
                        `where the app is (${root}): add react and react-dom to its ` +
                        `package.json, or build with mochiPlugin({ shared: false })`
                )
              }
            }
            // A second React on the page breaks every hook.
            const own = item.moduleIds.find(bundlesReact)
            if (own) {
              // The file, without Rollup's marks for a module it made.
              const file = own.replace(/^\0/, '').replace(/\?.*$/, '')
              this.error(
                `${item.fileName} bundles ${file}, which the shared files hold`
              )
            }
          }
        }
        for (const file of built?.files ?? []) {
          this.emitFile({
            type: 'asset',
            fileName: inBundle(file.fileName),
            source: file.code,
          })
        }
      },
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
        const built = react && (await react)
        const files = built ? bundled(built) : undefined
        const directory = path.posix.dirname(context.chunk.fileName)
        const relative = (file) => path.posix.relative(directory, file)
        let page
        if (built) {
          page = { names: {}, files: {}, menu: MENU_SHARED }
          for (const [name, file] of Object.entries(files.names)) {
            page.names[name] = relative(file)
          }
          for (const file of built.files) {
            page.files[relative(inBundle(file.fileName))] = createHash('sha256')
              .update(file.code)
              .digest('base64')
          }
        }
        const script = await loaderScript(
          found[1],
          manifest(context.bundle, context.chunk.fileName, files),
          styles,
          page
        )
        return html.replace(stylesheet, '').replace(found[0], () => script)
      },
    },
  }
}
