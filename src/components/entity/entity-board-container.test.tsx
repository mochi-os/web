// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: Apache-2.0

import { describe, it, expect } from 'vitest'
import {
  render,
  screen,
  createMockEntityDesign,
  createMockEntityObject,
} from './entity-test-utils'
import { EntityBoardContainer } from './entity-board-container'

describe('EntityBoardContainer', () => {
  it('names the column of cards with no value "[not set]", whatever field the board is on', async () => {
    const objects = [
      createMockEntityObject({ id: 'a', values: { title: 'Placed', status: 'todo' } }),
      createMockEntityObject({ id: 'b', values: { title: 'Loose' } }),
    ]
    render(
      <EntityBoardContainer
        design={createMockEntityDesign()}
        containerId='c1'
        fallbackTitle={(object) => object.id}
        objects={objects}
        statusField='status'
      />
    )
    // The column shows only while a card has no value, so finding it is the test.
    expect(await screen.findByText('[not set]')).toBeTruthy()
    expect(screen.queryByText('No status')).toBeNull()
  })

  it('names that column "[not set]" in swimlanes too', async () => {
    const objects = [
      createMockEntityObject({ id: 'a', values: { title: 'Placed', status: 'todo', priority: 'high' } }),
      createMockEntityObject({ id: 'b', values: { title: 'Loose', priority: 'high' } }),
    ]
    render(
      <EntityBoardContainer
        design={createMockEntityDesign()}
        containerId='c1'
        fallbackTitle={(object) => object.id}
        objects={objects}
        statusField='status'
        rowField='priority'
      />
    )
    expect(await screen.findByText('[not set]')).toBeTruthy()
    expect(screen.queryByText('No status')).toBeNull()
  })
})
