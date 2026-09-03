// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: Apache-2.0

import { describe, it, expect } from 'vitest'
import { entityObjectTitle } from './entity-title'
import type { EntityClass } from '../types/entity-object'

const classes: EntityClass[] = [
  { id: 'task', name: 'Task', rank: 0, title: 'name' },
  { id: 'note', name: 'Note', rank: 1, title: '' },
]

describe('entityObjectTitle', () => {
  it('uses the class title field when it holds a value', () => {
    const obj = { class: 'task', values: { name: 'Ship the release' } }
    expect(entityObjectTitle(obj, classes)).toBe('Ship the release')
  })

  it('falls back to the readable id when the app numbers its objects', () => {
    const obj = { class: 'task', number: 14, values: { name: '' } }
    expect(entityObjectTitle(obj, classes, 'PROJ')).toBe('PROJ-14')
  })

  it('falls back to Untitled when the app does not number its objects', () => {
    const obj = { class: 'task', values: { name: '' } }
    expect(entityObjectTitle(obj, classes)).toBe('Untitled')
  })

  it('does not print PREFIX-undefined when the number is missing', () => {
    const obj = { class: 'task', values: { name: '' } }
    expect(entityObjectTitle(obj, classes, 'PROJ')).toBe('Untitled')
  })

  it('falls back when the class declares no title field', () => {
    const obj = { class: 'note', number: 3, values: { name: 'ignored' } }
    expect(entityObjectTitle(obj, classes, 'PROJ')).toBe('PROJ-3')
  })

  it("prefers the server's own readable id over one rebuilt from the prefix", () => {
    const obj = { class: 'task', number: 14, readable: 'PROJ-0014', values: { name: '' } }
    expect(entityObjectTitle(obj, classes, 'PROJ')).toBe('PROJ-0014')
  })

  it('falls back when the class is unknown', () => {
    const obj = { class: 'gone', values: { name: 'ignored' } }
    expect(entityObjectTitle(obj, classes)).toBe('Untitled')
  })
})
