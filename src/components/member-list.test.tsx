// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: Apache-2.0

import { describe, it, expect } from 'vitest'
import { render, screen } from './entity/entity-test-utils'
import { MemberList } from './member-list'

const members = [
  { id: 'c', name: 'Carol' },
  { id: 'b', name: 'Bob' },
  { id: 'a', name: 'Alice' },
]

const names = () =>
  screen
    .getAllByRole('listitem')
    .map((row) => row.querySelector('.truncate')?.textContent)

describe('MemberList', () => {
  it('sorts by name', () => {
    render(<MemberList members={members} />)
    expect(names()).toEqual(['Alice', 'Bob', 'Carol'])
  })

  it('pins the current user first when there is no owner', () => {
    render(<MemberList members={members} currentUserId='c' />)
    expect(names()).toEqual(['Carol', 'Alice', 'Bob'])
  })

  it('pins the owner first, then the current user', () => {
    render(<MemberList members={members} ownerId='b' currentUserId='c' />)
    expect(names()).toEqual(['Bob', 'Carol', 'Alice'])
  })
})
