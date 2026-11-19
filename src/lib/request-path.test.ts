// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: Apache-2.0

import { describe, it, expect } from 'vitest'
import { path, tryPath } from './request-path'

describe('path', () => {
  it('keeps the literal parts and plain values as written', () => {
    expect(path`${'abc'}/-/${'post1'}/image`).toBe('abc/-/post1/image')
    expect(path`-/list`).toBe('-/list')
    expect(path`/${'feeds'}/${'abc'}/-/info`).toBe('/feeds/abc/-/info')
  })

  it('writes a number as its digits', () => {
    expect(path`${'abc'}/-/page/${0}`).toBe('abc/-/page/0')
    expect(path`${'abc'}/-/page/${12}`).toBe('abc/-/page/12')
  })

  it.each([
    ['a backslash', 'a\\b', 'a%5Cb'],
    ['a backslash climb', '..\\..\\-\\delete', '..%5C..%5C-%5Cdelete'],
    ['a query', 'delete?x=1', 'delete%3Fx%3D1'],
    ['a fragment', 'x#y', 'x%23y'],
    ['an ampersand', 'a&b=c', 'a%26b%3Dc'],
    ['a percent', '%2e%2e', '%252e%252e'],
    ['an encoded slash', 'a%2Fb', 'a%252Fb'],
    ['a space', 'a b', 'a%20b'],
    ['a non-ASCII name', 'café', 'caf%C3%A9'],
  ])('keeps %s inside one segment', (_name, value, encoded) => {
    const built = path`${'E'}/-/objects/${value}/update`
    expect(built).toBe(`E/-/objects/${encoded}/update`)
    // The parser sees the segments as written: nothing climbs, and no query
    // or fragment starts.
    const url = new URL(built, 'https://mochi.example/projects/')
    expect(url.pathname).toBe(`/projects/E/-/objects/${encoded}/update`)
    expect(url.search).toBe('')
    expect(url.hash).toBe('')
  })

  it.each([
    ['empty', ''],
    ['a dot', '.'],
    ['two dots', '..'],
    // Core decodes the path before splitting it, so an encoded slash would
    // still be a separator there.
    ['a slash', 'a/b'],
    ['a climb', '../delete?x='],
    ['a leading slash', '/feeds'],
  ])('refuses %s', (_name, value) => {
    expect(() => path`${'E'}/-/objects/${value}`).toThrow(Error)
    expect(() => path`${value}/-/info`).toThrow(Error)
  })

  it('refuses a value that is neither a string nor a number', () => {
    const values: unknown[] = [undefined, null, {}, ['a'], true, Symbol('x')]
    for (const value of values) {
      expect(() => path`${value as string}/-/info`).toThrow(Error)
    }
  })

  it('refuses a number that is not finite', () => {
    expect(() => path`${'E'}/-/page/${Number.NaN}`).toThrow(Error)
    expect(() => path`${'E'}/-/page/${Infinity}`).toThrow(Error)
  })

  it('keeps a dotted value that is not a dot segment', () => {
    expect(path`${'...'}`).toBe('...')
    expect(path`${'a.b'}`).toBe('a.b')
  })
})

describe('tryPath', () => {
  it('gives the path when every value is accepted', () => {
    expect(tryPath(() => path`${'E'}/-/info`)).toBe('E/-/info')
  })

  it('gives undefined when a value is refused', () => {
    expect(tryPath(() => path`${'..'}/-/info`)).toBeUndefined()
    expect(tryPath(() => path`${''}/-/info`)).toBeUndefined()
  })
})
