// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: Apache-2.0

import { describe, expect, it } from 'vitest'
import { addressByAuthor } from './comment-tree'

interface Row {
  id: string
  author: string
  approved?: boolean
  children?: Row[]
}

const options = {
  getAuthor: (row: Row) => row.author,
  getAddress: (row: Row) =>
    row.approved === false ? undefined : `/rows/${row.id}/asset`,
  getChildren: (row: Row) => row.children,
}

describe('addressByAuthor', () => {
  it('gives every author the address of their first row', () => {
    const rows: Row[] = [
      { id: 'a1', author: 'ann' },
      { id: 'b1', author: 'bob' },
      { id: 'a2', author: 'ann' },
      { id: 'b2', author: 'bob' },
    ]
    expect(Object.fromEntries(addressByAuthor(rows, options))).toEqual({
      ann: '/rows/a1/asset',
      bob: '/rows/b1/asset',
    })
  })

  it('walks replies in display order, before the next top-level row', () => {
    const rows: Row[] = [
      {
        id: 'a1',
        author: 'ann',
        children: [{ id: 'c1', author: 'cat', children: [] }],
      },
      { id: 'c2', author: 'cat' },
    ]
    expect(addressByAuthor(rows, options).get('cat')).toBe('/rows/c1/asset')
  })

  it('passes over a row that may not stand in for its author', () => {
    const rows: Row[] = [
      { id: 'a1', author: 'ann', approved: false },
      { id: 'a2', author: 'ann' },
      { id: 'b1', author: 'bob', approved: false },
    ]
    const found = addressByAuthor(rows, options)
    expect(found.get('ann')).toBe('/rows/a2/asset')
    expect(found.has('bob')).toBe(false)
  })

  it('keeps a seeded row ahead of the list', () => {
    const found = addressByAuthor(
      [{ id: 'a1', author: 'ann' }],
      options,
      new Map([['ann', '/posts/p1/asset']])
    )
    expect(found.get('ann')).toBe('/posts/p1/asset')
  })
})
