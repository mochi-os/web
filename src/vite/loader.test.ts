// @vitest-environment node
// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: Apache-2.0

import { mkdtempSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { build } from 'vite'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { manifest, mochiPlugin } from './mochi-plugin.js'

// jsdom ships no types here; this is the little of it the tests use.
type Window = Record<string, unknown> & {
  document: Document
  addEventListener: (
    type: string,
    listener: (event: MessageEvent) => void
  ) => void
  close: () => void
}
type Dom = { window: Window }
type Jsdom = {
  JSDOM: new (html: string, options: Record<string, unknown>) => Dom
  ResourceLoader: new () => object
}
const { JSDOM, ResourceLoader } = createRequire(import.meta.url)(
  'jsdom'
) as Jsdom

// An app small enough to read whole, built as the apps are: a static import
// cycle, a stylesheet with an emitted asset (its URL comes from
// import.meta.url), a live binding, two dynamic chunks sharing a third, a
// dynamic chunk that imports back into the entry, and top-level await.
const SOURCES: Record<string, string> = {
  'index.html': `<!doctype html>
<html><head><meta charset="UTF-8" />
<script>window.__started = true</script>
<script type="module" src="/src/main.js"></script>
</head><body><div id="root"></div></body></html>`,
  'src/main.js': `
import './style.css'
import { count, bump } from './counter.js'
import { a } from './cycle-a.js'
export const entry = 'entry'
// How many stylesheets were in place when the app began to run.
window.__styled =
  (document.adoptedStyleSheets || []).length +
  document.querySelectorAll('link[rel="stylesheet"]').length
bump()
const live = count
Promise.all([import('./one.js'), import('./two.js')]).then(([one, two]) => {
  window.__result = { live, cycle: a(), one: one.value, two: two.value, meta: one.meta, back: one.back, styled: window.__styled }
}, (error) => { window.__result = { error: String(error) } })
`,
  'src/counter.js': `export let count = 0\nexport function bump() { count++ }\n`,
  'src/cycle-a.js': `import { b } from './cycle-b.js'\nexport function a() { return 'a' + b() }\nexport function name() { return 'A' }\n`,
  'src/cycle-b.js': `import { name } from './cycle-a.js'\nexport function b() { return 'b' + name() }\n`,
  'src/shared.js': `export const shared = 'shared:' + Math.random().toString(36).slice(2)\nexport const big = ${JSON.stringify('x'.repeat(2000))}\n`,
  'src/one.js': `import { shared } from './shared.js'\nimport { entry } from './main.js'\nexport const value = 'one ' + shared\nexport const meta = import.meta.url\nexport const back = entry\n`,
  'src/two.js': `import { shared } from './shared.js'\nawait new Promise((resolve) => setTimeout(resolve, 5))\nexport const value = 'two ' + shared\n`,
  // Faces as real sheets write them: one plain; one whose src list leads
  // with sources the browser would pass over (an EOT, declared and not) and
  // ends in a data: address, whose semicolon and comma are its own; one read
  // from the sheet's own text; one that holds only inside an @media; one with
  // metric overrides and variation settings; and one declaring a descriptor
  // the font loading API has no name for.
  'src/style.css': `#root { background-image: url(./pixel.png); }
@font-face { font-family: 'Test Face'; src: url(./face.woff2) format('woff2'); font-weight: 400; unicode-range: U+0000-00FF; }
@font-face { font-family: "Second Face"; src: url(./legacy.eot) format('embedded-opentype'), url(./legacy.eot), url(./second.woff2) format("woff2"), url(data:font/woff;base64,d09GRgABAAA=) format('woff'); font-weight: 700; }
@font-face { font-family: 'Inline Face'; src: url(data:font/woff2;base64,d09GMgABAAA=) format('woff2'); }
@media (min-width: 1px) { @font-face { font-family: 'Nested Face'; src: url(./face.woff2) format('woff2'); } }
@font-face { font-family: 'Metric Face'; src: url(./face.woff2) format('woff2'); size-adjust: 105%; ascent-override: 90%; descent-override: 20%; line-gap-override: 0%; font-variation-settings: 'wght' 500; }
@font-face { font-family: 'Language Face'; src: url(./face.woff2) format('woff2'); font-language-override: 'TRK'; }
`,
}

// A one-pixel PNG, emitted as its own asset.
const PIXEL = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
  'base64'
)

// A font file's stand-in: bytes the test can recognise.
const FACE = Buffer.from('wOF2-test-face-bytes')
const SECOND = Buffer.from('wOF2-second-face-bytes')
const LEGACY = Buffer.from('legacy-eot-bytes')

let root = ''
let output = ''

async function bundle(frame: boolean, out: string) {
  await build({
    root,
    configFile: false,
    logLevel: 'silent',
    base: './',
    plugins: [mochiPlugin({ frame })],
    build: {
      outDir: out,
      emptyOutDir: true,
      target: 'es2022',
      assetsInlineLimit: 0,
      minify: false,
      // A chunk the entry imports statically, with a live binding across
      // the boundary.
      rollupOptions: {
        output: {
          manualChunks: (id: string) =>
            id.includes('counter') ? 'vendor' : undefined,
        },
      },
    },
  })
}

beforeAll(async () => {
  root = mkdtempSync(path.join(tmpdir(), 'mochi-loader-'))
  for (const [name, text] of Object.entries(SOURCES)) {
    mkdirSync(path.dirname(path.join(root, name)), { recursive: true })
    writeFileSync(path.join(root, name), text)
  }
  writeFileSync(path.join(root, 'src/pixel.png'), PIXEL)
  writeFileSync(path.join(root, 'src/face.woff2'), FACE)
  writeFileSync(path.join(root, 'src/second.woff2'), SECOND)
  writeFileSync(path.join(root, 'src/legacy.eot'), LEGACY)
  output = path.join(root, 'dist')
  await bundle(true, output)
}, 60000)

const ORIGIN = 'http://mochi.test'

// Serves the built app at /app/, recording what it was asked for. Anything
// under /app/ that is not a file is the app's page, as core serves it. A
// browser gives a frame its iframe's name as window.name; jsdom does not, so
// a page served for a named frame sets it first. jsdom constructs
// stylesheets but cannot adopt one; sheets gives the frame a list to adopt
// into.
// The font loading API, which jsdom lacks: a FontFace records how it was
// made and loads when the test says the page drew with it, as a browser loads
// a face only then; document.fonts holds faces and takes listeners. jsdom has
// no blob addresses either.
const FONTS = `window.__faces = [];
window.FontFace = function (family, source, descriptors) {
  var face = this;
  this.family = family; this.source = source; this.descriptors = descriptors;
  this.loaded = new Promise(function (resolve) { face.draw = function () { resolve(face) } });
  window.__faces.push(this);
};
URL.createObjectURL = function () { return 'blob:null/test' };
(function () {
  var held = new Set();
  var set = new EventTarget();
  set.add = function (face) { held.add(face) };
  set.delete = function (face) { held.delete(face) };
  set.has = function (face) { return held.has(face) };
  Object.defineProperty(document, 'fonts', { value: set });
})();`

function server(dist: string, frame?: string, sheets = false, fonts = false) {
  const asked: string[] = []
  class Loader extends ResourceLoader {
    fetch(url: string) {
      asked.push(url)
      const { pathname } = new URL(url)
      let file = path.join(dist, pathname.replace(/^\/app\//, ''))
      if (!pathname.startsWith('/app/assets/'))
        file = path.join(dist, 'index.html')
      let body: Buffer
      try {
        body = readFileSync(file)
      } catch {
        return Promise.reject(new Error('404 ' + url))
      }
      if (frame && !pathname.startsWith('/app/assets/')) {
        body = Buffer.from(
          body
            .toString('utf8')
            .replace(
              '<head>',
              `<head><script>window.name = ${JSON.stringify(frame)}` +
                (sheets
                  ? ";Object.defineProperty(document, 'adoptedStyleSheets', { value: [], writable: true })"
                  : '') +
                (fonts ? ';' + FONTS : '') +
                '</script>'
            )
        )
      }
      const promise = Promise.resolve(body) as Promise<Buffer> & {
        abort: () => void
      }
      promise.abort = () => {}
      return promise
    }
  }
  return { loader: new Loader(), asked }
}

const scripts = (asked: string[]) =>
  asked.filter((url) => url.includes('/assets/') && url.endsWith('.js'))

async function until(test: () => unknown, what: string) {
  for (let i = 0; i < 400; i++) {
    if (test()) return
    await new Promise((resolve) => setTimeout(resolve, 10))
  }
  throw new Error('timed out waiting for ' + what)
}

type Result = {
  styled?: number
  live?: number
  cycle?: string
  one?: string
  two?: string
  meta?: string
  back?: string
  error?: string
}

// The page in a frame of a shell page that carries fetches, as shell.js's
// handleFetch does: GETs under the frame's own app, answered with the bytes.
function framed(
  name: string,
  answer: 'script' | 'refuse' | 'page' = 'script',
  sheets = false,
  fonts: boolean | 'refused' = false
) {
  const site = server(output, name, sheets, fonts !== false)
  const carried: string[] = []
  const dom = new JSDOM(
    `<!doctype html><html><body><iframe name="${name}" src="${ORIGIN}/app/?_shell=1"></iframe></body></html>`,
    {
      url: ORIGIN + '/',
      runScripts: 'dangerously',
      resources: site.loader,
      beforeParse(window: Window) {
        window.TextDecoder = TextDecoder
      },
    }
  )
  dom.window.addEventListener('message', (event: MessageEvent) => {
    const data = event.data as Record<string, unknown>
    if (data?.type !== 'fetch') return
    // jsdom's postMessage sets neither source nor origin, which the loader
    // checks, so the answer is dispatched as a browser would deliver it. A
    // stylesheet is answered last, so an app that ran before it was in place
    // would show.
    const reply = (message: Record<string, unknown>) => {
      const target = frame() as unknown as Window & {
        MessageEvent: typeof MessageEvent
        dispatchEvent: (event: Event) => void
      }
      const late = String(data.url).endsWith('.css') ? 50 : 0
      setTimeout(
        () =>
          target.dispatchEvent(
            new target.MessageEvent('message', {
              data: { type: 'fetch.result', id: data.id, ...message },
              origin: ORIGIN,
              source: dom.window as unknown as MessageEventSource,
            })
          ),
        late
      )
    }
    const url = new URL(String(data.url))
    if (
      answer === 'refuse' ||
      !url.pathname.startsWith('/app/') ||
      (fonts === 'refused' && url.pathname.endsWith('.woff2'))
    ) {
      reply({ refused: true })
      return
    }
    carried.push(url.href)
    const bytes = readFileSync(
      path.join(output, url.pathname.replace(/^\/app\//, ''))
    )
    reply({
      status: 200,
      // A page where a script was asked for: a server's not-found page, say.
      headers: [
        [
          'content-type',
          answer === 'page'
            ? 'text/html'
            : url.pathname.endsWith('.woff2')
              ? 'font/woff2'
              : url.pathname.endsWith('.eot')
                ? 'application/vnd.ms-fontobject'
                : url.pathname.endsWith('.css')
                  ? 'text/css; charset=utf-8'
                  : 'text/javascript; charset=utf-8',
        ],
      ],
      body: bytes.buffer.slice(
        bytes.byteOffset,
        bytes.byteOffset + bytes.length
      ),
    })
  })
  const frame = () =>
    (dom.window.document.querySelector('iframe') as HTMLIFrameElement)
      .contentWindow as unknown as Window
  return { dom, frame, asked: site.asked, carried }
}

async function result(window: () => Window): Promise<Result> {
  await until(() => window()?.__result, 'the app to run')
  return window().__result as Result
}

function expectApp(app: Result) {
  expect(app.error).toBeUndefined()
  // Live binding: the entry read the counter after bumping it.
  expect(app.live).toBe(1)
  // The cycle within the entry chunk resolved both ways.
  expect(app.cycle).toBe('abA')
  // The two dynamic chunks share one instance of the third.
  const shared = app.one?.replace('one ', '')
  expect(shared).toMatch(/^shared:/)
  expect(app.two).toBe('two ' + shared)
  // A dynamic chunk importing back into the entry gets its live module.
  expect(app.back).toBe('entry')
  // The app ran with its stylesheet already in place.
  expect(app.styled).toBe(1)
  // import.meta.url is the chunk's own address, not where its text came from.
  expect(app.meta).toMatch(
    new RegExp('^' + ORIGIN + '/app/assets/one-[\\w-]+\\.js$')
  )
}

describe('mochiPlugin: the built page loads its System.register bundle', () => {
  afterAll(() => {})

  it('replaces the module entry with the inline loader', () => {
    const page = readFileSync(path.join(output, 'index.html'), 'utf8')
    expect(page).not.toMatch(/type="module"/)
    expect(page).not.toMatch(/modulepreload/)
    // The stylesheet is the loader's to put in place, not a <link> of its own.
    expect(page.replace(/<script>[\s\S]*?<\/script>/g, '')).not.toMatch(
      /<link rel="stylesheet"/
    )
    expect(page).toMatch(/"\.\/assets\/[\w-]+\.css"/)
    expect(page).toMatch(/<script>window.__started = true<\/script>/)
    expect(page).toContain('mochi:bridge')
    // The entry's own static import is asked for with it, from the start.
    expect(page).toMatch(/"vendor-[\w-]+\.js"/)
    const entry = readFileSync(
      path.join(
        output,
        'assets',
        page.match(/"\.\/assets\/(index-[\w-]+\.js)"/)![1]
      ),
      'utf8'
    )
    expect(entry.trimStart().startsWith('System.register(')).toBe(true)
  })

  it('runs the app as a top-level page, each chunk fetched once', async () => {
    const site = server(output)
    const dom = new JSDOM(
      readFileSync(path.join(output, 'index.html'), 'utf8'),
      {
        url: ORIGIN + '/app/',
        runScripts: 'dangerously',
        resources: site.loader,
      }
    )
    try {
      expectApp(await result(() => dom.window))
      const fetched = scripts(site.asked)
      expect(fetched.length).toBeGreaterThanOrEqual(4)
      expect(new Set(fetched).size).toBe(fetched.length)
      // The stylesheet is a blocking <link>, as the page had before.
      const links = [
        ...dom.window.document.querySelectorAll('link[rel="stylesheet"]'),
      ].map((link) => (link as HTMLLinkElement).href)
      expect(links).toHaveLength(1)
      expect(links[0]).toMatch(
        new RegExp('^' + ORIGIN + '/app/assets/[\\w-]+\\.css$')
      )
      expect(site.asked).toContain(links[0])
    } finally {
      dom.window.close()
    }
  })

  it('takes its code through the shell in a frame the shell named', async () => {
    const shell = framed('mochi:bridge', 'script', true)
    try {
      expectApp(await result(shell.frame))
      // THE POINT: the frame fetched none of its code or style itself; the
      // shell carried each file once.
      expect(scripts(shell.asked)).toEqual([])
      expect(shell.asked.filter((url) => url.endsWith('.css'))).toEqual([])
      expect(shell.carried.filter((url) => url.endsWith('.css'))).toHaveLength(
        1
      )
      // Adopted with the fonts and images it names at their own addresses,
      // as a <link> resolves them: a constructed sheet would resolve them
      // against the page.
      const adopted = (
        shell.frame().document as unknown as {
          adoptedStyleSheets: CSSStyleSheet[]
        }
      ).adoptedStyleSheets
      expect(adopted).toHaveLength(1)
      const rules = [...adopted[0].cssRules].map((rule) => rule.cssText)
      expect(rules.join('\n')).toMatch(
        new RegExp('url\\("?' + ORIGIN + '/app/assets/pixel-[\\w-]+\\.png"?\\)')
      )
      // A dark shell does not paint the frame white while it waits for it.
      const styles = [
        ...(shell.frame().document as Document).querySelectorAll('style'),
      ].map((element) => element.textContent)
      expect(styles).toContain(':root.dark{color-scheme:dark}')
      expect(shell.carried.length).toBeGreaterThanOrEqual(4)
      expect(new Set(shell.carried).size).toBe(shell.carried.length)
    } finally {
      shell.dom.window.close()
    }
  })

  type Face = {
    family: string
    source: unknown
    descriptors: Record<string, string>
    draw: () => void
  }
  type Fonts = {
    __faces: Face[]
    document: Document & {
      adoptedStyleSheets: CSSStyleSheet[]
      fonts: EventTarget & { has: (face: unknown) => boolean }
    }
  }

  // The faces registered for a family, oldest first.
  const faces = (window: Fonts, family: string) =>
    window.__faces.filter((face) => face.family === family)

  it("fetches an adopted sheet's fonts through the shell, and only those the page draws with", async () => {
    const shell = framed('mochi:bridge', 'script', true, true)
    try {
      expectApp(await result(shell.frame))
      const window = shell.frame() as unknown as Fonts
      // The sheet keeps no rule for the face: it is registered in the rule's
      // place with a blank font from a blob address, which the browser loads
      // only when the page draws in the face's range.
      const rules = [...window.document.adoptedStyleSheets[0].cssRules].map(
        (rule) => rule.cssText
      )
      expect(rules.join('\n')).not.toMatch(/Test Face/)
      expect(faces(window, 'Test Face')).toHaveLength(1)
      const placeholder = faces(window, 'Test Face')[0]
      expect(placeholder.source).toBe('url(blob:null/test)')
      expect(placeholder.descriptors).toMatchObject({
        weight: '400',
        unicodeRange: 'U+0000-00FF',
      })
      // A face the page has not drawn with is not fetched.
      await new Promise((resolve) => setTimeout(resolve, 100))
      expect(shell.carried.some((url) => url.endsWith('.woff2'))).toBe(false)

      placeholder.draw()
      await until(
        () => faces(window, 'Test Face').length === 2,
        'the face to be added'
      )
      const face = faces(window, 'Test Face')[1]
      expect(face.descriptors).toEqual(placeholder.descriptors)
      expect(Object.prototype.toString.call(face.source)).toBe(
        '[object ArrayBuffer]'
      )
      expect(new TextDecoder().decode(face.source as ArrayBuffer)).toBe(
        FACE.toString()
      )
      expect(window.document.fonts.has(face)).toBe(true)
      expect(window.document.fonts.has(placeholder)).toBe(false)
      // THE POINT: the shell carried the font, once.
      expect(
        shell.carried.filter((url) => url.endsWith('.woff2'))
      ).toHaveLength(1)
    } finally {
      shell.dom.window.close()
    }
  })

  it('loads a font from its own address when the shell will not carry it', async () => {
    const shell = framed('mochi:bridge', 'script', true, 'refused')
    try {
      expectApp(await result(shell.frame))
      const window = shell.frame() as unknown as Fonts
      const placeholder = faces(window, 'Test Face')[0]
      placeholder.draw()
      await until(
        () => faces(window, 'Test Face').length === 2,
        'the face to be added'
      )
      const face = faces(window, 'Test Face')[1]
      expect(face.source).toMatch(
        new RegExp(
          '^url\\("?' + ORIGIN + '/app/assets/face-[\\w-]+\\.woff2"?\\)'
        )
      )
      expect(window.document.fonts.has(placeholder)).toBe(false)
      expect(window.document.fonts.has(face)).toBe(true)
    } finally {
      shell.dom.window.close()
    }
  })

  it('fetches the first source the browser would read, past an EOT', async () => {
    const shell = framed('mochi:bridge', 'script', true, true)
    try {
      expectApp(await result(shell.frame))
      const window = shell.frame() as unknown as Fonts
      const placeholder = faces(window, 'Second Face')[0]
      expect(placeholder.descriptors).toEqual({ weight: '700' })
      placeholder.draw()
      await until(
        () => faces(window, 'Second Face').length === 2,
        'the face to be added'
      )
      const face = faces(window, 'Second Face')[1]
      // THE POINT: the WOFF2 the src list offers third, not the EOT before it.
      expect(new TextDecoder().decode(face.source as ArrayBuffer)).toBe(
        SECOND.toString()
      )
      expect(shell.carried.some((url) => url.endsWith('.eot'))).toBe(false)
      // CONTROL: the shell carried a font, so the EOT was passed over rather
      // than the face left unloaded.
      expect(
        shell.carried.filter((url) => /\/second-[\w-]+\.woff2$/.test(url))
      ).toHaveLength(1)
    } finally {
      shell.dom.window.close()
    }
  })

  it('falls back to the whole src list, a data: address with its semicolon intact', async () => {
    const shell = framed('mochi:bridge', 'script', true, 'refused')
    try {
      expectApp(await result(shell.frame))
      const window = shell.frame() as unknown as Fonts
      faces(window, 'Second Face')[0].draw()
      await until(
        () => faces(window, 'Second Face').length === 2,
        'the face to be added'
      )
      const source = String(faces(window, 'Second Face')[1].source)
      expect(source).toMatch(/second-[\w-]+\.woff2/)
      expect(source).toMatch(
        /url\(data:font\/woff;base64,d09GRgABAAA=\) format\(['"]woff['"]\)$/
      )
    } finally {
      shell.dom.window.close()
    }
  })

  it('leaves a face read from the sheet itself, or held by an @media, in the sheet', async () => {
    const shell = framed('mochi:bridge', 'script', true, true)
    try {
      expectApp(await result(shell.frame))
      const window = shell.frame() as unknown as Fonts
      const rules = [...window.document.adoptedStyleSheets[0].cssRules]
        .map((rule) => rule.cssText)
        .join('\n')
      // THE POINT: neither is registered from here, and both stay as written.
      expect(faces(window, 'Nested Face')).toHaveLength(0)
      expect(faces(window, 'Inline Face')).toHaveLength(0)
      expect(rules).toMatch(/@media[^{]*\{\s*@font-face\s*\{[^}]*Nested Face/)
      expect(rules).toMatch(/Inline Face/)
      // CONTROL: the top-level faces beside them were taken.
      expect(faces(window, 'Test Face')).toHaveLength(1)
      expect(faces(window, 'Second Face')).toHaveLength(1)
      expect(rules).not.toMatch(/Test Face|Second Face/)
    } finally {
      shell.dom.window.close()
    }
  })

  it("carries a face's metric overrides and variation settings", async () => {
    const shell = framed('mochi:bridge', 'script', true, true)
    try {
      expectApp(await result(shell.frame))
      const window = shell.frame() as unknown as Fonts
      const placeholder = faces(window, 'Metric Face')[0]
      expect(placeholder.descriptors).toEqual({
        sizeAdjust: '105%',
        ascentOverride: '90%',
        descentOverride: '20%',
        lineGapOverride: '0%',
        variationSettings: expect.stringMatching(/^['"]wght['"] 500$/),
      })
      placeholder.draw()
      await until(
        () => faces(window, 'Metric Face').length === 2,
        'the face to be added'
      )
      expect(faces(window, 'Metric Face')[1].descriptors).toEqual(
        placeholder.descriptors
      )
    } finally {
      shell.dom.window.close()
    }
  })

  it('leaves a face declaring what a registered face cannot carry in the sheet', async () => {
    const shell = framed('mochi:bridge', 'script', true, true)
    try {
      expectApp(await result(shell.frame))
      const window = shell.frame() as unknown as Fonts
      const rules = [...window.document.adoptedStyleSheets[0].cssRules]
        .map((rule) => rule.cssText)
        .join('\n')
      expect(faces(window, 'Language Face')).toHaveLength(0)
      expect(rules).toMatch(/Language Face/)
    } finally {
      shell.dom.window.close()
    }
  })

  // ready settles on the placeholder, and a face built from its bytes is
  // loaded before it is added, so the set would announce nothing of it.
  it('announces a face it swaps in once the face has loaded', async () => {
    const shell = framed('mochi:bridge', 'script', true, true)
    try {
      expectApp(await result(shell.frame))
      const window = shell.frame() as unknown as Fonts
      const announced: unknown[] = []
      window.document.fonts.addEventListener('loadingdone', (event) =>
        announced.push((event as Event & { fontfaces: unknown }).fontfaces)
      )
      faces(window, 'Test Face')[0].draw()
      await until(
        () => faces(window, 'Test Face').length === 2,
        'the face to be added'
      )
      const face = faces(window, 'Test Face')[1]
      await new Promise((resolve) => setTimeout(resolve, 20))
      expect(announced).toEqual([])
      face.draw()
      await until(() => announced.length > 0, 'the face to be announced')
      expect(announced).toEqual([[face]])
    } finally {
      shell.dom.window.close()
    }
  })

  it('leaves a face loaded from its own address for the browser to announce', async () => {
    const shell = framed('mochi:bridge', 'script', true, 'refused')
    try {
      expectApp(await result(shell.frame))
      const window = shell.frame() as unknown as Fonts
      const announced: Event[] = []
      window.document.fonts.addEventListener('loadingdone', (event) =>
        announced.push(event)
      )
      faces(window, 'Test Face')[0].draw()
      await until(
        () => faces(window, 'Test Face').length === 2,
        'the face to be added'
      )
      faces(window, 'Test Face')[1].draw()
      await new Promise((resolve) => setTimeout(resolve, 20))
      expect(announced).toEqual([])
    } finally {
      shell.dom.window.close()
    }
  })

  it('asks for every chunk a dynamic chunk needs at once', async () => {
    const shell = framed('mochi:bridge')
    try {
      await result(shell.frame)
      const one = shell.carried.findIndex((url) => /\/one-/.test(url))
      const shared = shell.carried.findIndex((url) => /\/shared-/.test(url))
      expect(one).toBeGreaterThanOrEqual(0)
      // The shared chunk is asked for with the chunk that imports it, not
      // after that chunk's text has come back and been read.
      expect(Math.abs(shared - one)).toBe(1)
    } finally {
      shell.dom.window.close()
    }
  })

  it('links the stylesheet where the browser cannot adopt one', async () => {
    const shell = framed('mochi:bridge')
    try {
      expectApp(await result(shell.frame))
      expect(scripts(shell.asked)).toEqual([])
      expect(shell.asked.filter((url) => url.endsWith('.css'))).toHaveLength(1)
    } finally {
      shell.dom.window.close()
    }
  })

  it('loads its code itself when the shell refuses', async () => {
    const shell = framed('mochi:bridge', 'refuse')
    try {
      expectApp(await result(shell.frame))
      expect(shell.carried).toEqual([])
      expect(scripts(shell.asked).length).toBeGreaterThanOrEqual(4)
    } finally {
      shell.dom.window.close()
    }
  })

  it('loads its code itself when the shell answers with anything but a script', async () => {
    const shell = framed('mochi:bridge', 'page')
    try {
      expectApp(await result(shell.frame))
      expect(scripts(shell.asked).length).toBeGreaterThanOrEqual(4)
    } finally {
      shell.dom.window.close()
    }
  })

  it('loads its code itself under a shell that names no frame', async () => {
    const shell = framed('')
    try {
      expectApp(await result(shell.frame))
      expect(shell.carried).toEqual([])
      expect(scripts(shell.asked).length).toBeGreaterThanOrEqual(4)
    } finally {
      shell.dom.window.close()
    }
  })
})

describe('mochiPlugin: pages that never load in the frame keep native modules', () => {
  it('leaves the module entry alone', async () => {
    const native = path.join(root, 'native')
    await bundle(false, native)
    const page = readFileSync(path.join(native, 'index.html'), 'utf8')
    expect(page).toMatch(
      /<script type="module" crossorigin src="\.\/assets\/index-/
    )
    expect(page).not.toContain('mochi:bridge')
  }, 60000)
})

describe('manifest: every chunk a chunk imports, directly or not', () => {
  it('closes over the import graph, relative to the entry', () => {
    const chunk = (fileName: string, imports: string[]) => ({
      type: 'chunk',
      fileName,
      imports,
    })
    const bundle = {
      a: chunk('assets/index.js', []),
      b: chunk('assets/route.js', ['assets/index.js', 'assets/card.js']),
      c: chunk('assets/card.js', ['assets/icon.js', 'assets/index.js']),
      d: chunk('assets/icon.js', []),
      e: { type: 'asset', fileName: 'assets/index.css' },
    }
    const [files, imports] = manifest(
      bundle as unknown as Parameters<typeof manifest>[0],
      'assets/index.js'
    )
    const named = imports.map(
      ([chunk, dependencies]) =>
        [
          files[chunk],
          dependencies.map((dependency) => files[dependency]),
        ] as const
    )
    expect(named).toEqual([
      ['card.js', ['icon.js', 'index.js']],
      ['route.js', ['card.js', 'icon.js', 'index.js']],
    ])
  })
})
