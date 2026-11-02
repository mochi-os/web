// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: Apache-2.0

import { describe, it, expect, vi } from 'vitest'
import { createEvent } from '@testing-library/react'
import {
  render,
  screen,
  fireEvent,
  waitFor,
  createMockEntityDesign,
  createMockEntityObject,
} from './entity-test-utils'
import { EntityTreeView } from './entity-tree-view'

// Each row reads the format once a render: counting the reads counts the rows
// drawn.
const drawing = vi.hoisted(() => ({ reads: 0 }))
vi.mock('../../hooks/use-format', async (original) => {
  const actual = await original<typeof import('../../hooks/use-format')>()
  return {
    ...actual,
    useFormat: () => {
      drawing.reads++
      return actual.useFormat()
    },
  }
})

const rows = () => document.querySelectorAll('tr[data-card-id]')

const titled = (count: number, status?: (index: number) => string) =>
  Array.from({ length: count }, (_, index) =>
    createMockEntityObject({
      id: `o${index}`,
      rank: String(index).padStart(4, '0'),
      values: {
        title: `Row ${index}`,
        ...(status ? { status: status(index) } : {}),
      },
    })
  )

const row = (id: string) =>
  document.querySelector(`tr[data-card-id="${id}"]`) as HTMLElement

// jsdom has no DataTransfer; the row handlers write effectAllowed/dropEffect.
const dataTransfer = {
  effectAllowed: 'move',
  dropEffect: 'move',
  setData: () => {},
  getData: () => '',
}

describe('EntityTreeView', () => {
  it("reorders a grouped row among its parent's children, not the section's rows", async () => {
    // One parent in the "To Do" section, three children in "Done": the
    // rendered neighbours of a child are the other children, but the parent
    // sits above them in the flattened row list.
    const objects = [
      createMockEntityObject({
        id: 'p1',
        rank: 'A',
        values: { title: 'Parent', status: 'todo' },
      }),
      createMockEntityObject({
        id: 'c1',
        parent: 'p1',
        rank: 'B',
        values: { title: 'First', status: 'done' },
      }),
      createMockEntityObject({
        id: 'c2',
        parent: 'p1',
        rank: 'C',
        values: { title: 'Second', status: 'done' },
      }),
      createMockEntityObject({
        id: 'c3',
        parent: 'p1',
        rank: 'D',
        values: { title: 'Third', status: 'done' },
      }),
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
    target.getBoundingClientRect = () => ({
      top: 0,
      height: 40,
      bottom: 40,
      left: 0,
      right: 0,
      width: 0,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    })
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
        objects={[
          createMockEntityObject({
            id: 'o1',
            class: 'bug',
            values: { title: 'Thing' },
          }),
        ]}
        viewFields='priority'
        peopleMap={{}}
        onCardClick={vi.fn()}
      />
    )
    // The task class's fields would otherwise head the table.
    expect(screen.queryByText('Priority')).toBeNull()
  })

  it('groups rows with no value under "[not set]"', async () => {
    const objects = [
      createMockEntityObject({ id: 'a', values: { title: 'Placed', status: 'todo' } }),
      createMockEntityObject({ id: 'b', values: { title: 'Loose' } }),
    ]
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
        onReorder={vi.fn()}
        onReparent={vi.fn()}
      />
    )
    await screen.findByText('Loose')
    expect(screen.getByText('[not set]')).toBeTruthy()
    expect(screen.queryByText('No status')).toBeNull()
  })

  it('draws the first hundred rows of a long list at once and the rest after', async () => {
    render(
      <EntityTreeView
        design={createMockEntityDesign()}
        containerId='c1'
        storagePrefix='tests'
        objects={titled(250)}
        peopleMap={{}}
        viewFields='title'
        onCardClick={vi.fn()}
      />
    )
    expect(rows()).toHaveLength(100)
    expect(rows()[0].getAttribute('data-card-id')).toBe('o0')
    await waitFor(() => expect(rows()).toHaveLength(250))
    expect(rows()[249].getAttribute('data-card-id')).toBe('o249')
  })

  it('draws a section once the rows before it are drawn', async () => {
    render(
      <EntityTreeView
        design={createMockEntityDesign()}
        containerId='c1'
        storagePrefix='tests'
        objects={titled(250, (index) => (index < 150 ? 'todo' : 'done'))}
        peopleMap={{}}
        viewFields='title,status'
        statusField='status'
        onCardClick={vi.fn()}
      />
    )
    expect(rows()).toHaveLength(100)
    expect(screen.getByText('To Do')).toBeTruthy()
    expect(screen.queryByText('Done')).toBeNull()
    await waitFor(() => expect(rows()).toHaveLength(250))
    expect(screen.getByText('Done')).toBeTruthy()
  })

  it('draws again only the rows a selection changes, whatever the page passes each time', async () => {
    const design = createMockEntityDesign()
    // Grouped by status, as a CRM's pipeline lists are, so the row fields
    // are the view's fields less the one grouped by.
    const objects = titled(60, () => 'todo')
    const people = {}
    // The page makes a new click handler on every render, as the objects
    // page does.
    const view = (selected?: string) => (
      <EntityTreeView
        design={design}
        containerId='c1'
        storagePrefix='tests'
        objects={objects}
        peopleMap={people}
        viewFields='title,status'
        statusField='status'
        selectedObjectId={selected}
        onCardClick={() => {}}
      />
    )
    const { rerender } = render(view())
    await waitFor(() => expect(rows()).toHaveLength(60))
    const before = drawing.reads
    rerender(view('o3'))
    expect(drawing.reads - before).toBeLessThanOrEqual(2)
    expect(rows()[3].className).toContain('bg-primary/10')
  })

  it('opens the row clicked, through the handler the page passed last', async () => {
    const design = createMockEntityDesign()
    const objects = titled(3)
    const first = vi.fn()
    const second = vi.fn()
    const view = (click: (object: unknown) => void) => (
      <EntityTreeView
        design={design}
        containerId='c1'
        storagePrefix='tests'
        objects={objects}
        peopleMap={{}}
        viewFields='title'
        onCardClick={click}
      />
    )
    const { rerender } = render(view(first))
    rerender(view(second))
    fireEvent.click(rows()[1])
    expect(first).not.toHaveBeenCalled()
    expect(second).toHaveBeenCalledWith(objects[1])
  })
})
