// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: Apache-2.0

import { describe, it, expect } from 'vitest'
import { checklistItems } from './checklist'

const read = (items: unknown) => checklistItems(JSON.stringify(items))

describe('checklistItems', () => {
  it('reads a well-formed list as written', () => {
    expect(
      read([
        { id: 'a', text: 'Draft', done: false },
        { id: 'b', text: 'Ship', done: true },
      ])
    ).toEqual([
      { id: 'a', text: 'Draft', done: false },
      { id: 'b', text: 'Ship', done: true },
    ])
  })

  it('reads anything but a JSON array as no items', () => {
    for (const value of [
      undefined,
      null,
      '',
      '  ',
      'not json',
      '5',
      '"a"',
      'null',
      '{"id":"a","text":"x","done":true}',
    ])
      expect(checklistItems(value)).toEqual([])
  })

  it('skips items that are not objects', () => {
    expect(
      read([null, 5, 'x', ['y'], { id: 'a', text: 'Kept', done: false }])
    ).toEqual([{ id: 'a', text: 'Kept', done: false }])
  })

  it('gives an item with no id one from its place in the list', () => {
    expect(
      read([
        null,
        { text: 'First' },
        { id: '', text: 'Second', done: true },
      ]).map((item) => item.id)
    ).toEqual(['item-1', 'item-2'])
  })

  it('gives a repeated id the place of its repeat', () => {
    expect(
      read([
        { id: 'a', text: 'One', done: false },
        { id: 'a', text: 'Two', done: false },
        { id: 'b', text: 'Three', done: false },
      ]).map((item) => item.id)
    ).toEqual(['a', 'a-1', 'b'])
  })

  it('keeps ids unique when a repair would repeat an earlier id', () => {
    expect(
      read([
        { id: 'a-2', text: 'One', done: false },
        { id: 'a', text: 'Two', done: false },
        { id: 'a', text: 'Three', done: false },
      ]).map((item) => item.id)
    ).toEqual(['a-2', 'a', 'a-2-2'])
  })

  it('gives the same ids on every read', () => {
    const value = JSON.stringify([
      { text: 'One' },
      { text: 'Two' },
      { id: 'x' },
      { id: 'x' },
    ])
    expect(checklistItems(value)).toEqual(checklistItems(value))
  })

  it('reads checked as done where done is absent', () => {
    expect(
      read([
        { id: 'a', text: 'Old', checked: true },
        { id: 'b', text: 'Older', checked: false },
        { id: 'c', text: 'Both', done: false, checked: true },
        { id: 'd', text: 'Neither' },
        { id: 'e', text: 'Not a flag', done: 'yes', checked: true },
      ]).map((item) => item.done)
    ).toEqual([true, false, false, false, true])
  })

  it('reads a text that is not a string as its text, or nothing', () => {
    expect(
      read([
        { id: 'a', text: null, done: false },
        { id: 'b', done: false },
        { id: 'c', text: { nested: 1 }, done: false },
        { id: 'd', text: 5, done: false },
      ]).map((item) => item.text)
    ).toEqual(['', '', '', '5'])
  })

  it('keeps other keys and drops checked', () => {
    expect(
      read([{ id: 'a', text: 'Kept', checked: true, due: '2026-12-01' }])
    ).toEqual([{ id: 'a', text: 'Kept', done: true, due: '2026-12-01' }])
  })
})
