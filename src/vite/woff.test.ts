// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: Apache-2.0
// @vitest-environment node

import { describe, it, expect } from 'vitest'
import { woffDrop } from './mochi-plugin.js'

type Item = {
  type: 'asset' | 'chunk'
  fileName: string
  source?: string
  code?: string
}

function bundle(items: Item[]): Record<string, Item> {
  return Object.fromEntries(items.map((item) => [item.fileName, item]))
}

// The fontsource stylesheets the theme imports name each face's WOFF beside
// its WOFF2, and every app zip carried the WOFF files, which no browser that
// can show the pages ever fetches.
describe('woffDrop', () => {
  it('drops a face’s WOFF where its WOFF2 is offered, and the file with it', () => {
    const built = bundle([
      {
        type: 'asset',
        fileName: 'assets/index-a1.css',
        source:
          '@font-face{font-family:Plex;src:url(./plex-400-b2.woff2)format("woff2"),url(./plex-400-c3.woff)format("woff");unicode-range:U+0000-00FF}' +
          "@font-face{font-family:Hyper;src:url('./hyper-700-d4.woff2') format('woff2'), url('./hyper-700-e5.woff') format('woff')}",
      },
      { type: 'asset', fileName: 'assets/plex-400-b2.woff2', source: 'x' },
      { type: 'asset', fileName: 'assets/plex-400-c3.woff', source: 'x' },
      { type: 'asset', fileName: 'assets/hyper-700-d4.woff2', source: 'x' },
      { type: 'asset', fileName: 'assets/hyper-700-e5.woff', source: 'x' },
    ])
    woffDrop(built)
    const css = built['assets/index-a1.css'].source!
    expect(css).toBe(
      '@font-face{font-family:Plex;src:url(./plex-400-b2.woff2)format("woff2");unicode-range:U+0000-00FF}' +
        "@font-face{font-family:Hyper;src:url('./hyper-700-d4.woff2') format('woff2')}"
    )
    expect(Object.keys(built).sort()).toEqual([
      'assets/hyper-700-d4.woff2',
      'assets/index-a1.css',
      'assets/plex-400-b2.woff2',
    ])
  })

  it('finds the files under an app’s own absolute base', () => {
    const built = bundle([
      {
        type: 'asset',
        fileName: 'assets/style-a1.css',
        source:
          '@font-face{font-family:Plex;src:url(/repositories/assets/plex-b2.woff2)format("woff2"),url(/repositories/assets/plex-c3.woff)format("woff")}',
      },
      { type: 'asset', fileName: 'assets/plex-b2.woff2', source: 'x' },
      { type: 'asset', fileName: 'assets/plex-c3.woff', source: 'x' },
    ])
    woffDrop(built)
    expect(Object.keys(built).sort()).toEqual([
      'assets/plex-b2.woff2',
      'assets/style-a1.css',
    ])
  })

  it('keeps a WOFF that is a face’s only form, and one named elsewhere', () => {
    const built = bundle([
      {
        type: 'asset',
        fileName: 'assets/index-a1.css',
        source:
          '@font-face{font-family:Old;src:url(./old-f6.woff)format("woff")}' +
          '@font-face{font-family:Plex;src:url(./plex-b2.woff2)format("woff2"),url(./plex-c3.woff)format("woff")}',
      },
      { type: 'asset', fileName: 'assets/old-f6.woff', source: 'x' },
      { type: 'asset', fileName: 'assets/plex-b2.woff2', source: 'x' },
      { type: 'asset', fileName: 'assets/plex-c3.woff', source: 'x' },
      {
        type: 'chunk',
        fileName: 'assets/index-g7.js',
        code: 'new FontFace("Plex","url(./plex-c3.woff)")',
      },
    ])
    woffDrop(built)
    expect(built['assets/index-a1.css'].source).toBe(
      '@font-face{font-family:Old;src:url(./old-f6.woff)format("woff")}' +
        '@font-face{font-family:Plex;src:url(./plex-b2.woff2)format("woff2")}'
    )
    expect(built['assets/old-f6.woff']).toBeDefined()
    expect(built['assets/plex-c3.woff']).toBeDefined()
  })

  it('leaves every other entry of the list as it was written', () => {
    const built = bundle([
      {
        type: 'asset',
        fileName: 'assets/index-a1.css',
        source:
          '@font-face{font-family:Inter;src:local("Inter, Regular"),url(./inter-b2.woff2)format("woff2")tech(variations),url(./inter-c3.woff)format("woff"),url(./inter-d4.ttf)}',
      },
      { type: 'asset', fileName: 'assets/inter-b2.woff2', source: 'x' },
      { type: 'asset', fileName: 'assets/inter-c3.woff', source: 'x' },
      { type: 'asset', fileName: 'assets/inter-d4.ttf', source: 'x' },
    ])
    woffDrop(built)
    expect(built['assets/index-a1.css'].source).toBe(
      '@font-face{font-family:Inter;src:local("Inter, Regular"),url(./inter-b2.woff2)format("woff2")tech(variations),url(./inter-d4.ttf)}'
    )
    expect(built['assets/inter-c3.woff']).toBeUndefined()
    expect(built['assets/inter-d4.ttf']).toBeDefined()
  })

  it('keeps a WOFF inlined as a data URI, which is no file', () => {
    const built = bundle([
      {
        type: 'asset',
        fileName: 'assets/index-a1.css',
        source:
          '@font-face{font-family:Small;src:url(./small-b2.woff2)format("woff2"),url(data:font/woff;base64,d09GRgAB)format("woff")}',
      },
      { type: 'asset', fileName: 'assets/small-b2.woff2', source: 'x' },
    ])
    woffDrop(built)
    expect(built['assets/index-a1.css'].source).toBe(
      '@font-face{font-family:Small;src:url(./small-b2.woff2)format("woff2"),url(data:font/woff;base64,d09GRgAB)format("woff")}'
    )
  })

  it('reads a list whose WOFF2 is inlined as a data URI whole', () => {
    const built = bundle([
      {
        type: 'asset',
        fileName: 'assets/index-a1.css',
        source:
          '@font-face{font-family:Tiny;src:url(data:font/woff2;base64,d09GMgAB)format("woff2"),url(./tiny-h8.woff)format("woff")}.x{--image-src:url(./tiny-h8.woff)format("woff2")}',
      },
      { type: 'asset', fileName: 'assets/tiny-h8.woff', source: 'x' },
    ])
    woffDrop(built)
    expect(built['assets/index-a1.css'].source).toBe(
      '@font-face{font-family:Tiny;src:url(data:font/woff2;base64,d09GMgAB)format("woff2")}.x{--image-src:url(./tiny-h8.woff)format("woff2")}'
    )
    // Still named by the custom property, which is no font face's list.
    expect(built['assets/tiny-h8.woff']).toBeDefined()
  })
})
