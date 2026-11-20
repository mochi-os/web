// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: Apache-2.0

// React, built apart from the app as fixed System.register files.
//
// Every app bundles its own React into its entry chunk, so each release of an
// app renames that chunk and browsers download React again with it. Built on
// its own, from four fixed entries, React comes out byte for byte the same
// whichever app builds it and whenever, so its files keep their names from
// one release to the next, and every app names the same files.
//
// A chunk split out of the app's own build (manualChunks) would not do: Rollup
// names its exports from what that app imports, so it differs app to app and
// can change with any release.

import { execFileSync } from 'node:child_process'
import path from 'node:path'
import { build } from 'vite'

// File name -> the specifier it stands for: every way the apps' code, and the
// packages it bundles, reach React and react-dom.
const ENTRIES = {
  react: 'react',
  'react-dom': 'react-dom',
  'react-dom-client': 'react-dom/client',
  'react-jsx-runtime': 'react/jsx-runtime',
}

const PREFIX = 'mochi-shared-react:'

// Each entry's export names, from React's production build, or null where
// React is not installed where the app is.
//
// Its development build exports two more (act, captureOwnerStack), and which
// one a require in this process gets depends on NODE_ENV and on what loaded
// React first, so the names are read in a process of their own with NODE_ENV
// production: the same list, and the same files, every build. NODE_PATH goes
// too: pnpm's commands set it to its whole store, where Node would find a
// React that Vite, which does not read it, then cannot.
function exportNames(root) {
  const script = `
const load = require('node:module').createRequire(process.argv[1])
const names = {}
try {
  for (const specifier of JSON.parse(process.argv[2])) {
    names[specifier] = Object.keys(load(specifier))
  }
} catch (error) {
  if (error.code !== 'MODULE_NOT_FOUND') throw error
  process.stdout.write('null')
  process.exit(0)
}
process.stdout.write(JSON.stringify(names))`
  const env = { ...process.env, NODE_ENV: 'production' }
  delete env.NODE_PATH
  const output = execFileSync(
    process.execPath,
    [
      '-e',
      script,
      path.join(root, 'package.json'),
      JSON.stringify(Object.values(ENTRIES)),
    ],
    { env, encoding: 'utf8' }
  )
  return JSON.parse(output)
}

/**
 * React's shared files, built from the copy installed where the app is, or
 * null where React is not installed there: { files, names }, files a list of
 * { fileName, code, imports } (imports the files it imports statically) and
 * names each specifier's file.
 */
export async function sharedReact(root) {
  const names = exportNames(root)
  if (!names) return null
  const result = await build({
    root,
    configFile: false,
    logLevel: 'silent',
    mode: 'production',
    publicDir: false,
    define: { 'process.env.NODE_ENV': JSON.stringify('production') },
    plugins: [
      {
        name: 'mochi-shared-react',
        resolveId(id) {
          return id.startsWith(PREFIX) ? '\0' + id : null
        },
        // The package's module.exports as the default export, as a CommonJS
        // package that requires React reads it, and each of its properties
        // as a named export, as an ES module imports them.
        load(id) {
          if (!id.startsWith('\0' + PREFIX)) return null
          const specifier = id.slice(PREFIX.length + 1)
          const named = names[specifier].filter(
            (name) => name !== 'default' && /^[A-Za-z_$][\w$]*$/.test(name)
          )
          return (
            `import exported from ${JSON.stringify(specifier)}\n` +
            `export default exported\n` +
            `export const { ${named.join(', ')} } = exported\n`
          )
        },
      },
    ],
    build: {
      write: false,
      modulePreload: false,
      reportCompressedSize: false,
      rollupOptions: {
        input: Object.fromEntries(
          Object.entries(ENTRIES).map(([name, specifier]) => [
            name,
            PREFIX + specifier,
          ])
        ),
        preserveEntrySignatures: 'strict',
        output: {
          format: 'system',
          // Hashed as the server expects of a file it may cache for a year.
          entryFileNames: '[name]-[hash].js',
          chunkFileNames: 'react-shared-[hash].js',
        },
      },
    },
  })
  const output = (Array.isArray(result) ? result[0] : result).output
  const files = []
  const named = {}
  for (const chunk of output) {
    if (chunk.type !== 'chunk') continue
    files.push({
      fileName: chunk.fileName,
      code: chunk.code,
      imports: chunk.imports,
    })
    if (chunk.isEntry) named[ENTRIES[chunk.name]] = chunk.fileName
  }
  return { files, names: named }
}

/**
 * Whether an import names React or react-dom, or a path inside either: what
 * an app leaves to the shared files.
 */
export function isReact(id) {
  return /^react(-dom)?(\/|$)/.test(id)
}

/**
 * Whether a module the app's build bundled is React's own code: a file of the
 * react or react-dom package, wherever pnpm keeps it.
 */
export function bundlesReact(id) {
  return /[\\/]node_modules[\\/]react(-dom)?[\\/]/.test(id)
}
