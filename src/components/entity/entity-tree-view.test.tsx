// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: Apache-2.0

import { describe, it, expect, vi } from 'vitest'
import { createEvent } from '@testing-library/react'
import {
  render,
  screen,
  fireEvent,
  createMockEntityDesign,
  createMockEntityObject,
} from './entity-test-utils'
import { EntityTreeView } from './entity-tree-view'

const row = (id: string) => document.querySelector(`tr[data-card-id="${id}"]`) as HTMLElement

// jsdom has no DataTransfer; the row handlers write effectAllowed/dropEffect.
const dataTransfer = { effectAllowed: 'move', dropEffect: 'move', setData: () => {}, getData: () => '' }

describe('EntityTreeView', () => {
  it('reorders a grouped row among its parent\'s children, not the section\'s rows', async () => {
    // One parent in the "To Do" section, three children in "Done": the
    // rendered neighbours of a child are the other children, but the parent
    // sits above them in the flattened row list.
    const objects = [
      createMockEntityObject({ id: 'p1', rank: 'A', values: { title: 'Parent', status: 'todo' } }),
      createMockEntityObject({ id: 'c1', parent: 'p1', rank: 'B', values: { title: 'First', status: 'done' } }),
      createMockEntityObject({ id: 'c2', parent: 'p1', rank: 'C', values: { title: 'Second', status: 'done' } }),
      createMockEntityObject({ id: 'c3', parent: 'p1', rank: 'D', values: { title: 'Third', status: 'done' } }),
    ]
    const onReorder = vi.fn()
    render(
      <EntityTreeView
        design={createMockEntityDesign()}
        containerId='c1'
        storagePrefix='tests'
        objects={objects}
        peopleMap={{}}
        viewFields='title'
        statusField='status'
        onCardClick={vi.fn()}
        onReorder={onReorder}
        onReparent={vi.fn()}
      />
    )
    await screen.findByText('Third')
    const target = row('c1')
    target.getBoundingClientRect = () => ({ top: 0, height: 40, bottom: 40, left: 0, right: 0, width: 0, x: 0, y: 0, toJSON: () => ({}) })
    fireEvent.dragStart(row('c3'), { dataTransfer })
    // jsdom's synthesised drag event carries no clientY; the row reads it.
    const over = createEvent.dragOver(target, { dataTransfer })
    Object.defineProperty(over, 'clientY', { value: 2 })
    fireEvent(target, over)
    fireEvent.dragEnd(row('c3'), { dataTransfer })
    // Slot 1 of the parent's children; the flattened section list would have
    // put the parent first and answered 2.
    expect(onReorder).toHaveBeenCalledWith('c3', 1)
  })

  it('assumes no class when the design has none, rather than a task class', () => {
    render(
      <EntityTreeView
        design={createMockEntityDesign({ classes: [] })}
        containerId='c1'
        storagePrefix='tests'
        objects={[createMockEntityObject({ id: 'o1', class: 'bug', values: { title: 'Thing' } })]}
        viewFields='priority'
        peopleMap={{}}
        onCardClick={vi.fn()}
      />
    )
    // The task class's fields would otherwise head the table.
    expect(screen.queryByText('Priority')).toBeNull()
  })
})
