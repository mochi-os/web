// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: Apache-2.0

import { describe, it, expect } from 'vitest'
import { entityDisplayValue, entitySearchText } from './entity-display'

const stage = { fieldtype: 'enumerated' }
const owner = { fieldtype: 'user' }
const options = [
  { id: 'lead', name: 'New lead', colour: '', icon: '', rank: 0 },
  { id: 'won', name: 'Gagné', colour: '', icon: '', rank: 1 },
]

describe('entityDisplayValue', () => {
  it('shows a select by its option name, not its id', () => {
    expect(entityDisplayValue(stage, 'won', { options })).toBe('Gagné')
  })

  it('gives the id back when the option is gone', () => {
    expect(entityDisplayValue(stage, 'lost', { options })).toBe('lost')
  })

  it('shows a person by name', () => {
    const people = { u1abc: 'Ada Lovelace' }
    expect(entityDisplayValue(owner, 'u1abc', { people })).toBe('Ada Lovelace')
  })

  it('names another item through objectTitle', () => {
    const objectTitle = (id: string) => (id === 'o1' ? 'Acme' : undefined)
    expect(
      entityDisplayValue({ fieldtype: 'object' }, 'o1', { objectTitle })
    ).toBe('Acme')
  })

  it('formats dates and numbers with the formatters it is given', () => {
    const formatDate = (d: Date) => `${d.getDate()}/${d.getMonth() + 1}`
    const formatNumber = (n: number, decimals?: number) =>
      `${n.toFixed(decimals)}!`
    expect(
      entityDisplayValue({ fieldtype: 'date' }, '2026-10-14', { formatDate })
    ).toBe('14/10')
    expect(
      entityDisplayValue({ fieldtype: 'number' }, '12.50', { formatNumber })
    ).toBe('12.50!')
  })

  it('summarises a checklist and survives one that is not a list', () => {
    const list = JSON.stringify([
      { id: 'a', text: 'Call', done: true },
      { id: 'b', text: 'Send quote', done: false },
    ])
    expect(entityDisplayValue({ fieldtype: 'checklist' }, list)).toBe('1/2')
    expect(entityDisplayValue({ fieldtype: 'checklist' }, '5')).toBe('')
    expect(entityDisplayValue({ fieldtype: 'checklist' }, '{')).toBe('')
  })

  it('marks a checked checkbox and leaves an unchecked one empty', () => {
    expect(entityDisplayValue({ fieldtype: 'checkbox' }, '1')).toBe('✓')
    expect(entityDisplayValue({ fieldtype: 'checkbox' }, '0')).toBe('')
  })

  it('passes text through and treats empty as empty', () => {
    expect(entityDisplayValue({ fieldtype: 'text' }, 'hello')).toBe('hello')
    expect(entityDisplayValue(stage, '', { options })).toBe('')
  })
})

describe('entitySearchText', () => {
  it('searches checklist item texts', () => {
    const list = JSON.stringify([{ id: 'a', text: 'Send quote', done: false }])
    expect(entitySearchText({ fieldtype: 'checklist' }, list)).toBe(
      'Send quote'
    )
  })

  it('searches a select by its name', () => {
    expect(entitySearchText(stage, 'lead', { options })).toBe('New lead')
  })
})
