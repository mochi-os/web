// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: Apache-2.0

import { afterEach, describe, it, expect, vi } from 'vitest'
import { createEvent } from '@testing-library/react'
import { getItem, removeItem, setItem } from '../../lib/shell-storage'
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
  // Two parents with a child each, the second stored open, in a container no
  // other test uses.
  const stored = 'tests:opened:tree:expanded'
  afterEach(() => removeItem(stored))
  const family = () => [
    createMockEntityObject({ id: 'p1', rank: 'A', values: { title: 'Parent one' } }),
    createMockEntityObject({ id: 'k1', parent: 'p1', rank: 'B', values: { title: 'Child one' } }),
    createMockEntityObject({ id: 'p2', rank: 'C', values: { title: 'Parent two' } }),
    createMockEntityObject({ id: 'k2', parent: 'p2', rank: 'D', values: { title: 'Child two' } }),
  ]
  const tree = () =>
    render(
      <EntityTreeView
        design={createMockEntityDesign()}
        containerId='opened'
        storagePrefix='tests'
        objects={family()}
        peopleMap={{}}
        viewFields='title'
        onCardClick={vi.fn()}
      />
    )

  it('opens a row clicked before the open rows are read, and keeps those open', async () => {
    setItem(stored, JSON.stringify(['p2']))
    tree()
    // The stored rows are read asynchronously: this click lands first.
    fireEvent.click(screen.getAllByRole('button', { name: 'Expand' })[0])
    await screen.findByText('Child two')
    expect(screen.getByText('Child one')).toBeTruthy()
    expect(JSON.parse((await getItem(stored)) ?? '[]').sort()).toEqual(['p1', 'p2'])
  })

  it('leaves a row open that was clicked open before the read showed it already was', async () => {
    setItem(stored, JSON.stringify(['p1']))
    tree()
    // The screen still shows it shut, so the click asks for it open.
    fireEvent.click(screen.getAllByRole('button', { name: 'Expand' })[0])
    await waitFor(() =>
      expect(screen.getAllByRole('button', { name: 'Collapse' }).length).toBe(1)
    )
    expect(screen.getByText('Child one')).toBeTruthy()
    expect(JSON.parse((await getItem(stored)) ?? '[]')).toEqual(['p1'])
  })

  it('folds a section clicked before the folded sections are read, as the screen asked, keeping the others folded', async () => {
    const sections = `${stored}:sections:status`
    setItem(sections, JSON.stringify(['done', 'todo']))
    render(
      <EntityTreeView
        design={createMockEntityDesign()}
        containerId='opened'
        storagePrefix='tests'
        objects={[
          createMockEntityObject({ id: 'a', values: { title: 'Alpha', status: 'todo' } }),
          createMockEntityObject({ id: 'b', values: { title: 'Beta', status: 'done' } }),
        ]}
        peopleMap={{}}
        viewFields='title'
        statusField='status'
        onCardClick={vi.fn()}
      />
    )
    // Both sections still show open, so the click asks for To Do folded.
    expect(screen.getByText('Alpha')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: /To Do/ }))
    await waitFor(() => expect(screen.queryByText('Beta')).toBeNull())
    expect(screen.queryByText('Alpha')).toBeNull()
    expect(JSON.parse((await getItem(sections)) ?? '[]').sort()).toEqual(['done', 'todo'])
    removeItem(sections)
  })

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
    // Above the parent's first child; in the flattened section list the row
    // above it is the parent itself. Every row of the section is p1's child,
    // so the server takes the neighbours from p1's children.
    expect(onReorder).toHaveBeenCalledWith('c3', { before: 'c1' }, 'p1')
  })

  it('asks for a key past the row drawn below a drop when the Manual sort is descending', async () => {
    const objects = [
      createMockEntityObject({ id: 'a', rank: 'A', values: { title: 'Alpha' } }),
      createMockEntityObject({ id: 'b', rank: 'B', values: { title: 'Beta' } }),
      createMockEntityObject({ id: 'c', rank: 'C', values: { title: 'Gamma' } }),
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
        sort={{ field: 'rank', direction: 'desc' }}
        onCardClick={vi.fn()}
        onReorder={onReorder}
      />
    )
    await screen.findByText('Alpha')
    expect([...rows()].map((r) => r.getAttribute('data-card-id'))).toEqual(['c', 'b', 'a'])
    const target = row('b')
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
    fireEvent.dragStart(row('a'), { dataTransfer })
    const over = createEvent.dragOver(target, { dataTransfer })
    Object.defineProperty(over, 'clientY', { value: 2 })
    fireEvent(target, over)
    fireEvent.dragEnd(row('a'), { dataTransfer })
    // Above b, below c: drawn in reverse, that is a key after b's and
    // before c's.
    expect(onReorder).toHaveBeenCalledWith('a', { after: 'b', before: 'c' }, '')
  })

  /** Drags `dragged` over the top (or bottom) edge of row `target` and drops it. */
  function drop(dragged: string, target: string, edge: 'top' | 'bottom' = 'top') {
    const el = row(target)
    el.getBoundingClientRect = () => ({ top: 0, height: 40, bottom: 40, left: 0, right: 0, width: 0, x: 0, y: 0, toJSON: () => ({}) })
    fireEvent.dragStart(row(dragged), { dataTransfer })
    const over = createEvent.dragOver(el, { dataTransfer })
    Object.defineProperty(over, 'clientY', { value: edge === 'top' ? 2 : 38 })
    fireEvent(el, over)
    fireEvent.dragEnd(row(dragged), { dataTransfer })
  }

  it('names both siblings either side of a drop, not a child drawn between them', async () => {
    // p1 is open, so its child k1 is drawn between it and p2.
    setItem(stored, JSON.stringify(['p1']))
    const onReorder = vi.fn()
    render(
      <EntityTreeView
        design={createMockEntityDesign()}
        containerId='opened'
        storagePrefix='tests'
        objects={[
          ...family(),
          createMockEntityObject({ id: 'p3', rank: 'E', values: { title: 'Parent three' } }),
        ]}
        peopleMap={{}}
        viewFields='title'
        onCardClick={vi.fn()}
        onReorder={onReorder}
      />
    )
    await screen.findByText('Child one')
    expect([...rows()].map((r) => r.getAttribute('data-card-id'))).toEqual(['p1', 'k1', 'p2', 'p3'])
    drop('p3', 'p2')
    expect(onReorder).toHaveBeenCalledWith('p3', { after: 'p1', before: 'p2' }, '')
    drop('p1', 'p2', 'bottom')
    expect(onReorder).toHaveBeenLastCalledWith('p1', { after: 'p2', before: 'p3' }, '')
  })

  it('names the rows of a grouped section either side of a drop, whatever their parents', async () => {
    const objects = [
      createMockEntityObject({ id: 'p1', rank: 'A', values: { title: 'Parent', status: 'todo' } }),
      createMockEntityObject({ id: 'c1', parent: 'p1', rank: 'B', values: { title: 'First', status: 'done' } }),
      createMockEntityObject({ id: 'x', rank: 'C', values: { title: 'Loose', status: 'done' } }),
      createMockEntityObject({ id: 'c3', parent: 'p1', rank: 'D', values: { title: 'Third', status: 'done' } }),
      createMockEntityObject({ id: 'c2', parent: 'p1', rank: 'E', values: { title: 'Second', status: 'done' } }),
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
      />
    )
    await screen.findByText('Second')
    drop('c2', 'c3')
    // The section holds a top-level row among p1's children, so no parent is
    // named: the server would refuse x as a neighbour among p1's children.
    expect(onReorder).toHaveBeenCalledWith('c2', { after: 'x', before: 'c3' }, undefined)
  })

  it('names no parent for a reorder among stories of two epics grouped by status', async () => {
    // An agile backlog showing stories only, grouped by status: S1 and S3
    // are E1's, S2 is E2's, and neither epic is shown.
    const objects = [
      createMockEntityObject({ id: 's1', parent: 'e1', rank: 'A', values: { title: 'Story one', status: 'todo' } }),
      createMockEntityObject({ id: 's2', parent: 'e2', rank: 'B', values: { title: 'Story two', status: 'todo' } }),
      createMockEntityObject({ id: 's3', parent: 'e1', rank: 'C', values: { title: 'Story three', status: 'todo' } }),
      createMockEntityObject({ id: 's4', parent: 'e2', rank: 'D', values: { title: 'Story four', status: 'todo' } }),
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
      />
    )
    await screen.findByText('Story four')
    drop('s1', 's3', 'bottom')
    expect(onReorder).toHaveBeenCalledWith('s1', { after: 's3', before: 's4' }, undefined)
  })

  it('names no parent for a reorder at the top level among rows whose parents are not shown, and names it when they share one', async () => {
    // t is top level; a and b are children of a parent not in the list, so
    // all three are drawn at the top level.
    const mixed = [
      createMockEntityObject({ id: 't', rank: 'A', values: { title: 'Top' } }),
      createMockEntityObject({ id: 'a', parent: 'hidden', rank: 'B', values: { title: 'Alpha' } }),
      createMockEntityObject({ id: 'b', parent: 'hidden', rank: 'C', values: { title: 'Beta' } }),
    ]
    const onReorder = vi.fn()
    const { unmount } = render(
      <EntityTreeView
        design={createMockEntityDesign()}
        containerId='c1'
        storagePrefix='tests'
        objects={mixed}
        peopleMap={{}}
        viewFields='title'
        onCardClick={vi.fn()}
        onReorder={onReorder}
      />
    )
    await screen.findByText('Beta')
    drop('b', 'a')
    expect(onReorder).toHaveBeenLastCalledWith('b', { after: 't', before: 'a' }, undefined)
    unmount()
    // Without t, every row drawn there is a child of the hidden parent.
    render(
      <EntityTreeView
        design={createMockEntityDesign()}
        containerId='c1'
        storagePrefix='tests'
        objects={mixed.slice(1)}
        peopleMap={{}}
        viewFields='title'
        onCardClick={vi.fn()}
        onReorder={onReorder}
      />
    )
    await screen.findByText('Beta')
    drop('b', 'a')
    expect(onReorder).toHaveBeenLastCalledWith('b', { before: 'a' }, 'hidden')
  })

  it('takes a row of another section of a grouped list as a parent across its whole height, never as a place beside it', async () => {
    // a and b in To Do; d in Done, with a key between theirs.
    const objects = [
      createMockEntityObject({ id: 'a', rank: 'A', values: { title: 'Alpha', status: 'todo' } }),
      createMockEntityObject({ id: 'd', rank: 'B', values: { title: 'Delta', status: 'done' } }),
      createMockEntityObject({ id: 'b', rank: 'C', values: { title: 'Beta', status: 'todo' } }),
    ]
    const onReorder = vi.fn()
    const onReparent = vi.fn()
    render(
      <EntityTreeView
        design={createMockEntityDesign({ hierarchy: { task: ['', 'task'] } })}
        containerId='c1'
        storagePrefix='tests'
        objects={objects}
        peopleMap={{}}
        viewFields='title'
        statusField='status'
        onCardClick={vi.fn()}
        onReorder={onReorder}
        onReparent={onReparent}
      />
    )
    await screen.findByText('Delta')
    drop('a', 'd')
    expect(onReorder).not.toHaveBeenCalled()
    expect(onReparent).toHaveBeenCalledWith('a', 'd')
    // Beside a row of its own section it is still a reorder.
    drop('a', 'b')
    expect(onReorder).toHaveBeenCalledWith('a', { before: 'b' }, '')
  })

  it('draws rows sharing a key in the reverse of the server’s order under the descending Manual sort, and names them either side of a drop', async () => {
    // p and q share a key, p the newer: the server lists p then q.
    const objects = [
      createMockEntityObject({ id: 'p', rank: 'B', created: 2000, values: { title: 'Newer' } }),
      createMockEntityObject({ id: 'q', rank: 'B', created: 1000, values: { title: 'Older' } }),
      createMockEntityObject({ id: 'r', rank: 'C', created: 3000, values: { title: 'Top' } }),
      createMockEntityObject({ id: 's', rank: 'A', created: 4000, values: { title: 'Bottom' } }),
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
        sort={{ field: 'rank', direction: 'desc' }}
        onCardClick={vi.fn()}
        onReorder={onReorder}
      />
    )
    await screen.findByText('Newer')
    expect([...rows()].map((r) => r.getAttribute('data-card-id'))).toEqual(['r', 'q', 'p', 's'])
    // Between q and p: after p in the server's order and before q.
    drop('s', 'p')
    expect(onReorder).toHaveBeenCalledWith('s', { after: 'p', before: 'q' }, '')
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
