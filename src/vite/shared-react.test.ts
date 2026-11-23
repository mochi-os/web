// @vitest-environment node
// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: Apache-2.0

import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  rmSync,
  readdirSync,
  readFileSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs'
import { createHash } from 'node:crypto'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { build } from 'vite'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { mochiPlugin, type MochiPluginOptions } from './mochi-plugin.js'

// lib/web's own node_modules, where React is installed.
const MODULES = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../node_modules'
)

// React's own marker, in every copy of its element code.
const MARKER = 'react.transitional.element'

// The server sends a file whose path matches this a year's cache
// (core/server/web.go, match_hashed).
const HASHED = /assets\/.*-[\w-]{8}\.[0-9A-Za-z]+$/

// The only names the shell carries from menu's folder to an app's frame
// (SHARED_FILE in apps/menu's shell.js). A name of another shape - a new hash
// length from a Rollup upgrade, say - would be refused there, and every app
// would quietly load its own copy. A copy, as this repo cannot read menu's:
// menu's shared-react-contract.test.ts checks the real rule against the real
// files.
const SHELL = /^[A-Za-z0-9_-]+-[A-Za-z0-9_-]{8}\.js$/

// A folder of its own for each app the tests build, removed once they have
// run. Its node_modules is a link, which removing the folder leaves alone.
const made: string[] = []
function temporary() {
  const folder = mkdtempSync(path.join(tmpdir(), 'mochi-shared-react-'))
  made.push(folder)
  return folder
}
afterAll(() => {
  for (const folder of made) rmSync(folder, { recursive: true, force: true })
})

// An app that imports React, with React installed beside it, as each app's
// web/ folder has it.
function app(main: string) {
  const root = temporary()
  mkdirSync(path.join(root, 'src'))
  writeFileSync(
    path.join(root, 'index.html'),
    `<!doctype html><html><head><meta charset="UTF-8" />
<script type="module" src="/src/main.js"></script>
</head><body><div id="root"></div></body></html>`
  )
  writeFileSync(path.join(root, 'src/main.js'), main)
  symlinkSync(MODULES, path.join(root, 'node_modules'), 'dir')
  return root
}

async function bundle(root: string, out: string, options?: MochiPluginOptions) {
  await build({
    root,
    configFile: false,
    logLevel: 'silent',
    base: './',
    plugins: [mochiPlugin(options)],
    build: { outDir: out, emptyOutDir: true },
  })
  return out
}

// Every file under dir, by its path relative to dir, with its bytes.
function files(dir: string, under = ''): Map<string, Buffer> {
  const found = new Map<string, Buffer>()
  for (const entry of readdirSync(path.join(dir, under), {
    withFileTypes: true,
  })) {
    const name = path.posix.join(under, entry.name)
    if (entry.isDirectory()) {
      for (const [file, bytes] of files(dir, name)) found.set(file, bytes)
    } else {
      found.set(name, readFileSync(path.join(dir, name)))
    }
  }
  return found
}

const shared = (dir: string) =>
  [...files(dir)].filter(([name]) => name.startsWith('assets/shared/'))

const MAIN = `import { useState } from 'react'
import { createRoot } from 'react-dom/client'
import { jsx } from 'react/jsx-runtime'
function App() { const [n] = useState(1); return jsx('p', { children: n }) }
createRoot(document.getElementById('root')).render(jsx(App, {}))
`

// A second app reaching React by other names and using less of it.
const OTHER = `import { flushSync } from 'react-dom'
import * as React from 'react'
window.__other = [flushSync, React.createElement]
`

let framed = ''
let unshared = ''

beforeAll(async () => {
  const root = app(MAIN)
  framed = await bundle(root, path.join(root, 'dist'))
  unshared = await bundle(root, path.join(root, 'unshared'), { shared: false })
}, 120000)

describe('mochiPlugin: React as shared files', () => {
  it('emits React as hashed System.register files in assets/shared/', () => {
    const emitted = shared(framed)
    const names = emitted.map(([name]) => path.posix.basename(name))
    // One file per entry, under its own name.
    for (const entry of [
      'react',
      'react-dom',
      'react-dom-client',
      'react-jsx-runtime',
    ]) {
      const named = new RegExp('^' + entry + '-[\\w-]{8}\\.js$')
      expect(names.filter((name) => named.test(name))).toHaveLength(1)
    }
    for (const [name, bytes] of emitted) {
      // THE POINT: a name the server caches for a year.
      expect(name).toMatch(HASHED)
      expect(path.posix.basename(name)).toMatch(SHELL)
      expect(bytes.toString('utf8').trimStart()).toMatch(/^System\.register\(/)
    }
    // React's code is in them.
    expect(
      emitted.filter(([, bytes]) => bytes.includes(MARKER)).length
    ).toBeGreaterThanOrEqual(1)
    // Each file another one imports is among them.
    const all = new Set(names)
    for (const [, bytes] of emitted) {
      const imports = /^\s*System\.register\(\[([^\]]*)\]/.exec(
        bytes.toString('utf8')
      )![1]
      for (const match of imports.matchAll(/["']\.\/([^"']+)["']/g)) {
        expect(all).toContain(match[1])
      }
    }
  })

  it('exports what React exports in production, and nothing from its development build', () => {
    const react = shared(framed).find(([name]) =>
      /\/react-[\w-]{8}\.js$/.test(name)
    )![1]
    const text = react.toString('utf8')
    for (const name of ['useState', 'createElement', 'Children', 'version']) {
      expect(text).toMatch(new RegExp('\\b' + name + '\\b'))
    }
    // Each entry also exports the package's module.exports as its default, as
    // a CommonJS package that requires React reads it.
    const entries = shared(framed).filter(([name]) =>
      /\/react(-dom|-dom-client|-jsx-runtime)?-[\w-]{8}\.js$/.test(name)
    )
    expect(entries).toHaveLength(4)
    for (const [, bytes] of entries) {
      expect(bytes.toString('utf8')).toMatch(/\(\s*["']default["']\s*,/)
    }
    // THE POINT: only React's development build exports these. Read from this
    // process, which Vitest runs outside production, they would be there.
    expect(text).not.toMatch(/\bcaptureOwnerStack\b/)
  })

  it('leaves React out of the app, and maps its four names in the page', () => {
    const own = [...files(framed)].filter(
      ([name]) => !name.startsWith('assets/shared/')
    )
    // THE POINT: no file of the app's own holds React's code.
    expect(own.some(([, data]) => data.includes(MARKER))).toBe(false)
    const page = readFileSync(path.join(framed, 'index.html'), 'utf8')
    for (const [name, file] of [
      ['react', 'react'],
      ['react-dom/client', 'react-dom-client'],
      ['react/jsx-runtime', 'react-jsx-runtime'],
    ]) {
      expect(page).toMatch(
        new RegExp('[{,]"?' + name + '"?:"shared/' + file + '-[\\w-]{8}\\.js"')
      )
    }
  })

  it('bundles React into the app with shared: false, as before', () => {
    const own = [...files(unshared)]
    expect(own.some(([, data]) => data.includes(MARKER))).toBe(true)
    expect(readFileSync(path.join(unshared, 'index.html'), 'utf8')).not.toMatch(
      /shared\//
    )
  })

  it('fails the build when a chunk still bundles React', async () => {
    // React's own file by its path, past the bare name the build leaves out.
    const root = app(
      `import React from '../node_modules/react/index.js'\nwindow.__react = React\n`
    )
    await expect(bundle(root, path.join(root, 'dist'))).rejects.toThrow(
      /bundles .*node_modules\/react\/index\.js, which the shared files hold/
    )
  }, 60000)

  it('fails the build when a dynamic React import has no shared file', async () => {
    const root = app(
      `import('react-dom/server').then((server) => { window.__server = server })\n`
    )
    await expect(bundle(root, path.join(root, 'dist'))).rejects.toThrow(
      /imports react-dom\/server, which has no shared file/
    )
  }, 60000)

  it('fails the build when a React import has no shared file', async () => {
    const root = app(
      `import { renderToString } from 'react-dom/server'\nwindow.__render = renderToString\n`
    )
    await expect(bundle(root, path.join(root, 'dist'))).rejects.toThrow(
      /imports react-dom\/server, which has no shared file/
    )
  }, 60000)

  it('gives the same files, byte for byte, from a different app', async () => {
    const root = app(OTHER)
    const other = await bundle(root, path.join(root, 'dist'))
    const theirs = new Map(shared(other))
    const ours = shared(framed)
    expect([...theirs.keys()].sort()).toEqual(ours.map(([name]) => name).sort())
    for (const [name, bytes] of ours) {
      expect(bytes.equals(theirs.get(name)!)).toBe(true)
    }
  }, 60000)

  it('emits none with shared: false', () => {
    expect(existsSync(path.join(unshared, 'assets/shared'))).toBe(false)
  })

  it('emits none for a page that never loads in the frame', async () => {
    const root = app(MAIN)
    const native = await bundle(root, path.join(root, 'dist'), { frame: false })
    expect(existsSync(path.join(native, 'assets/shared'))).toBe(false)
  }, 60000)

  it("gives the page each shared file's SHA-256, and menu's folder", () => {
    const page = readFileSync(path.join(framed, 'index.html'), 'utf8')
    const emitted = shared(framed)
    expect(emitted.length).toBeGreaterThanOrEqual(4)
    for (const [name, bytes] of emitted) {
      const digest = createHash('sha256').update(bytes).digest('base64')
      // THE POINT: the digest of the bytes the app ships, so it runs only
      // those from menu.
      expect(page).toContain(
        JSON.stringify(name.replace(/^assets\//, '')) +
          ':' +
          JSON.stringify(digest)
      )
    }
    expect(page).toContain('"/menu/assets/shared/"')
  })

  it('hosts them on a page that never loads in the frame, with shared: true', async () => {
    const root = app(MAIN)
    const host = await bundle(root, path.join(root, 'dist'), {
      frame: false,
      shared: true,
    })
    // The same files every framed app carries.
    const theirs = new Map(shared(host))
    const ours = shared(framed)
    expect([...theirs.keys()].sort()).toEqual(ours.map(([name]) => name).sort())
    for (const [name, bytes] of ours) {
      expect(bytes.equals(theirs.get(name)!)).toBe(true)
    }
    // The page itself is as it was: native modules, its own React.
    const page = readFileSync(path.join(host, 'index.html'), 'utf8')
    expect(page).toMatch(
      /<script type="module" crossorigin src="\.\/assets\/index-/
    )
    expect(page).not.toContain('mochi:bridge')
    const own = [...files(host)].filter(
      ([name]) => !name.startsWith('assets/shared/')
    )
    expect(own.some(([, data]) => data.includes(MARKER))).toBe(true)
  }, 60000)

  it('builds without them where React is not installed', async () => {
    const root = temporary()
    writeFileSync(
      path.join(root, 'index.html'),
      '<!doctype html><html><head><script type="module" src="/main.js"></script></head><body></body></html>'
    )
    writeFileSync(path.join(root, 'main.js'), 'window.__ran = true\n')
    const out = await bundle(root, path.join(root, 'dist'))
    expect(existsSync(path.join(out, 'index.html'))).toBe(true)
    expect(existsSync(path.join(out, 'assets/shared'))).toBe(false)
  }, 60000)
})
