// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: Apache-2.0

import { describe, it, expect, vi } from 'vitest'
import { createEvent, fireEvent } from '@testing-library/react'
import {
  render,
  screen,
  createMockEntityClass,
  createMockEntityDesign,
  createMockEntityField,
  createMockEntityObject,
  createMockEntityOption,
} from './entity-test-utils'
import { EntityBoardContainer } from './entity-board-container'

/** Gives `el` a box `height` tall starting at `top`, as layout would. */
function place(el: Element, top: number, height: number) {
  el.getBoundingClientRect = () =>
    ({ top, bottom: top + height, height, left: 0, right: 200, width: 200, x: 0, y: top, toJSON: () => ({}) }) as DOMRect
}

/** A drag event over `el` at height `y`, carrying object `id` of `objectClass`. */
function dragAt(type: 'dragOver' | 'drop', el: Element, y: number, id: string, objectClass: string) {
  const event = createEvent[type](el)
  const dataTransfer = {
    types: ['text/plain', `application/x-mochi-class-${objectClass}`, `application/x-mochi-id-${id}`],
    getData: () => id,
    dropEffect: 'move',
  }
  Object.defineProperty(event, 'clientY', { value: y })
  Object.defineProperty(event, 'dataTransfer', { value: dataTransfer })
  fireEvent(el, event)
  return dataTransfer
}

describe('EntityBoardContainer', () => {
  it('names the column of cards with no value "[not set]", whatever field the board is on', async () => {
    const objects = [
      createMockEntityObject({
        id: 'a',
        values: { title: 'Placed', status: 'todo' },
      }),
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
      createMockEntityObject({
        id: 'a',
        values: { title: 'Placed', status: 'todo', priority: 'high' },
      }),
      createMockEntityObject({
        id: 'b',
        values: { title: 'Loose', priority: 'high' },
      }),
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

  describe('collapsing a column', () => {
    const collapseLabels = {
      collapse: (name: string) => `Collapse ${name}`,
      expand: (name: string) => `Expand ${name}`,
    }
    const objects = [
      createMockEntityObject({
        id: 'a',
        values: { title: 'First', status: 'todo' },
      }),
      createMockEntityObject({
        id: 'b',
        values: { title: 'Second', status: 'todo' },
      }),
    ]

    function renderBoard(extra: Record<string, unknown> = {}) {
      const onToggle = vi.fn()
      render(
        <EntityBoardContainer
          design={createMockEntityDesign()}
          containerId='c1'
          fallbackTitle={(object) => object.id}
          objects={objects}
          statusField='status'
          onToggleColumnCollapsed={onToggle}
          collapseLabels={collapseLabels}
          {...extra}
        />
      )
      return onToggle
    }

    it('shows each column count beside its name', async () => {
      renderBoard()
      const name = await screen.findByText('To Do')
      expect(name.parentElement).toHaveTextContent('To Do2')
    })

    it('offers to collapse a column and says which one', async () => {
      const onToggle = renderBoard()
      const button = await screen.findByRole('button', {
        name: 'Collapse To Do',
      })
      expect(button).toHaveAttribute('aria-expanded', 'true')
      // Cards show their fallback title, the object id, in this fixture.
      expect(screen.getByText('a')).toBeTruthy()
      fireEvent.click(button)
      expect(onToggle).toHaveBeenCalledWith('todo')
    })

    it('shows a collapsed column as its name and count, without its cards', async () => {
      const onToggle = renderBoard({ collapsedColumns: ['todo'] })
      const strip = await screen.findByRole('button', { name: 'Expand To Do' })
      expect(strip).toHaveAttribute('aria-expanded', 'false')
      expect(strip).toHaveTextContent('To Do2')
      expect(screen.queryByText('a')).toBeNull()
      expect(screen.queryByText('b')).toBeNull()
      // The other columns are untouched.
      expect(screen.getByRole('button', { name: 'Collapse Done' })).toBeTruthy()
      fireEvent.click(strip)
      expect(onToggle).toHaveBeenCalledWith('todo')
    })

    it('offers no collapse without labels to name the control', async () => {
      renderBoard({ collapseLabels: undefined })
      await screen.findByText('To Do')
      expect(screen.queryByRole('button', { name: /Collapse/ })).toBeNull()
    })

    it('collapses swimlane columns too, narrowing them in the grid', async () => {
      const onToggle = renderBoard({
        rowField: 'priority',
        collapsedColumns: ['todo'],
      })
      const strip = await screen.findByRole('button', { name: 'Expand To Do' })
      expect(strip).toHaveTextContent('To Do2')
      expect(screen.queryByText('a')).toBeNull()
      expect(screen.getByRole('button', { name: 'Collapse Done' })).toBeTruthy()

      const grid = strip.closest<HTMLElement>('.grid')
      expect(grid?.style.gridTemplateColumns).toBe(
        'max-content 2.5rem 18rem 18rem'
      )
      fireEvent.click(strip)
      expect(onToggle).toHaveBeenCalledWith('todo')
    })

    it('keeps a card in its own row when dropped on a collapsed swimlane column', async () => {
      const onMoveObject = vi.fn()
      const rowed = [
        createMockEntityObject({
          id: 'a',
          values: { title: 'First', status: 'todo', priority: 'high' },
        }),
        createMockEntityObject({
          id: 'b',
          values: { title: 'Second', status: 'done', priority: 'high' },
        }),
      ]
      renderBoard({
        objects: rowed,
        rowField: 'priority',
        collapsedColumns: ['done'],
        onMoveObject,
      })
      const strip = (await screen.findByRole('button', { name: 'Expand Done' }))
        .parentElement as HTMLElement
      const dataTransfer = {
        types: [
          'text/plain',
          'application/x-mochi-class-task',
          'application/x-mochi-id-a',
        ],
        getData: () => 'a',
        dropEffect: 'move',
      }
      fireEvent.dragOver(strip, { dataTransfer, clientY: 10 })
      fireEvent.drop(strip, { dataTransfer })

      expect(onMoveObject).toHaveBeenCalled()
      const [objectId, column, place, row] = onMoveObject.mock.calls[0]
      // After "b", the last card of its row there.
      expect([objectId, column, place, row]).toEqual(['a', 'done', { after: 'b' }, 'high'])
    })

    // Card a in To Do, and two cards in Done, drawn b then c.
    const flat = [
      createMockEntityObject({ id: 'a', rank: 'a0', values: { title: 'First', status: 'todo' } }),
      createMockEntityObject({ id: 'b', rank: 'a1', values: { title: 'Second', status: 'done' } }),
      createMockEntityObject({ id: 'c', rank: 'a2', values: { title: 'Third', status: 'done' } }),
    ]
    async function dropOnStrip(extra: Record<string, unknown> = {}) {
      const onMoveObject = vi.fn()
      renderBoard({ objects: flat, collapsedColumns: ['done'], onMoveObject, ...extra })
      const strip = (await screen.findByRole('button', { name: 'Expand Done' }))
        .parentElement as HTMLElement
      dragAt('dragOver', strip, 10, 'a', 'task')
      dragAt('drop', strip, 10, 'a', 'task')
      return onMoveObject
    }

    it('drops a card on a collapsed column after its last card', async () => {
      const onMoveObject = await dropOnStrip()
      expect(onMoveObject).toHaveBeenCalledWith('a', 'done', { after: 'c' }, undefined, undefined, undefined, undefined)
    })

    it('drops a card on a collapsed column below its last card when the Manual sort is descending', async () => {
      // Drawn c then b: b, the last, holds the lowest key.
      const onMoveObject = await dropOnStrip({ sort: { field: 'rank', direction: 'desc' } })
      expect(onMoveObject).toHaveBeenCalledWith('a', 'done', { before: 'b' }, undefined, undefined, undefined, undefined)
    })
  })

  describe('dropping between cards under the sort shown', () => {
    // Three cards in To Do and one in Done, which is dragged.
    const objects = [
      createMockEntityObject({ id: 'a', rank: 'a0', values: { title: 'First', status: 'todo' } }),
      createMockEntityObject({ id: 'b', rank: 'a1', values: { title: 'Second', status: 'todo' } }),
      createMockEntityObject({ id: 'c', rank: 'a2', values: { title: 'Third', status: 'todo' } }),
      createMockEntityObject({ id: 'x', rank: 'a3', values: { title: 'Moving', status: 'done' } }),
    ]

    async function board(sort?: { field: string; direction: 'asc' | 'desc' }) {
      const onMoveObject = vi.fn()
      const { container } = render(
        <EntityBoardContainer
          design={createMockEntityDesign()}
          containerId='c1'
          fallbackTitle={(object) => object.id}
          objects={objects}
          statusField='status'
          sort={sort}
          onMoveObject={onMoveObject}
        />
      )
      // Cards show their fallback title, the object id, in this fixture.
      await screen.findByText('x')
      const card = (id: string) => container.querySelector(`[data-card-id="${id}"]`)!
      // The cards are laid out in the order they are drawn, 40px apart.
      const drawn = [...(card('a').parentElement as HTMLElement).children].filter((el) => el.hasAttribute('data-card-id'))
      drawn.forEach((el, index) => place(el, index * 50, 40))
      const gap = () => container.querySelector('.border-dashed')
      return { onMoveObject, card, drawn, gap, list: card('a').parentElement as HTMLElement }
    }

    it('lands a card in the gap below the top card when the Manual sort is descending', async () => {
      const { onMoveObject, drawn, list } = await board({ field: 'rank', direction: 'desc' })
      expect(drawn.map((el) => el.getAttribute('data-card-id'))).toEqual(['c', 'b', 'a'])
      // Below c's middle, above b's.
      dragAt('dragOver', list, 45, 'x', 'task')
      dragAt('drop', list, 45, 'x', 'task')
      // A key between b's and c's, which the reversed list draws below c.
      expect(onMoveObject).toHaveBeenCalledWith('x', 'todo', { after: 'b', before: 'c' }, undefined, undefined, undefined, undefined)
    })

    it('draws a gap between cards under the Manual sort', async () => {
      const { gap, list } = await board()
      dragAt('dragOver', list, 45, 'x', 'task')
      expect(gap()).not.toBeNull()
    })

    it('draws no gap under another sort, and sends a card dropped in another column to its end', async () => {
      const { onMoveObject, gap, list } = await board({ field: 'created', direction: 'asc' })
      dragAt('dragOver', list, 45, 'x', 'task')
      expect(gap()).toBeNull()
      dragAt('drop', list, 45, 'x', 'task')
      expect(onMoveObject).toHaveBeenCalledWith('x', 'todo', undefined, undefined, undefined, undefined, undefined)
    })

    it('writes nothing for a card dropped back in its own column under another sort', async () => {
      const { onMoveObject, list } = await board({ field: 'created', direction: 'asc' })
      dragAt('dragOver', list, 45, 'a', 'task')
      dragAt('drop', list, 45, 'a', 'task')
      expect(onMoveObject).not.toHaveBeenCalled()
    })
  })

  describe('dropping on the column for no value', () => {
    // A card in To Do; in the column for no value, one with none and one
    // whose value no column is drawn for, drawn u then s.
    const objects = [
      createMockEntityObject({ id: 'a', rank: 'a0', values: { title: 'Valued', status: 'todo' } }),
      createMockEntityObject({ id: 'u', rank: 'a1', values: { title: 'Unset' } }),
      createMockEntityObject({ id: 's', rank: 'a2', values: { title: 'Stale', status: 'gone' } }),
    ]

    async function board(sort?: { field: string; direction: 'asc' | 'desc' }) {
      const onMoveObject = vi.fn()
      const { container } = render(
        <EntityBoardContainer
          design={createMockEntityDesign()}
          containerId='c1'
          fallbackTitle={(object) => object.id}
          objects={objects}
          statusField='status'
          sort={sort}
          onMoveObject={onMoveObject}
        />
      )
      await screen.findByText('u')
      const card = (id: string) => container.querySelector(`[data-card-id="${id}"]`)!
      const list = card('u').parentElement as HTMLElement
      place(card('u'), 0, 40)
      place(card('s'), 50, 40)
      return { onMoveObject, list }
    }

    it('clears the column of a card dropped there from another column', async () => {
      const { onMoveObject, list } = await board()
      dragAt('dragOver', list, 95, 'a', 'task')
      dragAt('drop', list, 95, 'a', 'task')
      expect(onMoveObject).toHaveBeenCalledWith('a', '', { after: 's' }, undefined, undefined, undefined, true)
    })

    it('reorders a card already drawn there without clearing it', async () => {
      const { onMoveObject, list } = await board()
      dragAt('dragOver', list, 10, 's', 'task')
      dragAt('drop', list, 10, 's', 'task')
      expect(onMoveObject).toHaveBeenCalledWith('s', '', { before: 'u' }, undefined, undefined, undefined, undefined)
    })

    it('writes nothing for a card drawn there whose value no column is drawn for, dropped back under another sort', async () => {
      const { onMoveObject, list } = await board({ field: 'created', direction: 'asc' })
      dragAt('dragOver', list, 95, 's', 'task')
      dragAt('drop', list, 95, 's', 'task')
      expect(onMoveObject).not.toHaveBeenCalled()
    })
  })

  describe('aiming a drag on a swimlane column', () => {
    const objects = [
      createMockEntityObject({ id: 'a', rank: 'a0', values: { title: 'First', status: 'todo', priority: 'high' } }),
      createMockEntityObject({ id: 'b', rank: 'a1', values: { title: 'Second', status: 'todo', priority: 'high' } }),
      createMockEntityObject({ id: 'c', rank: 'a0', values: { title: 'Third', status: 'done', priority: 'low' } }),
    ]

    it('aims at the top of the first row over the header, and carries no aim into the next drag', async () => {
      const onMoveObject = vi.fn()
      const { container } = render(
        <EntityBoardContainer
          design={createMockEntityDesign()}
          containerId='c1'
          fallbackTitle={(object) => object.id}
          objects={objects}
          statusField='status'
          rowField='priority'
          onMoveObject={onMoveObject}
        />
      )
      await screen.findByText('c')
      const card = (id: string) => container.querySelector(`[data-card-id="${id}"]`)!
      const column = card('a').closest('[data-row-id]')!.parentElement as HTMLElement
      const header = column.firstElementChild as HTMLElement
      // The header, then the high, medium and low rows, 100px each.
      place(header, 0, 40)
      column.querySelectorAll('[data-row-id]').forEach((row, index) => place(row, 100 + index * 100, 100))
      place(card('a'), 110, 30)
      place(card('b'), 150, 30)
      const high = card('a').closest('[data-row-id]') as HTMLElement

      // Between a and b in the high row.
      dragAt('dragOver', high, 145, 'c', 'task')
      dragAt('drop', high, 145, 'c', 'task')
      expect(onMoveObject).toHaveBeenLastCalledWith('c', 'todo', { after: 'a', before: 'b' }, 'high', undefined, undefined, undefined)

      // Over the header: above a, at the top of the high row.
      dragAt('dragOver', header, 10, 'c', 'task')
      dragAt('drop', header, 10, 'c', 'task')
      expect(onMoveObject).toHaveBeenLastCalledWith('c', 'todo', { before: 'a' }, 'high', undefined, undefined, undefined)

      // Below every row nothing is aimed at: no neighbour, and the card
      // keeps its own row.
      dragAt('dragOver', column, 1000, 'c', 'task')
      dragAt('drop', column, 1000, 'c', 'task')
      expect(onMoveObject).toHaveBeenLastCalledWith('c', 'todo', {}, undefined, undefined, undefined, undefined)
    })
  })

  describe('folding a swimlane row', () => {
    const collapseLabels = {
      collapse: (name: string) => `Collapse ${name}`,
      expand: (name: string) => `Expand ${name}`,
    }
    const objects = [
      createMockEntityObject({
        id: 'a',
        values: { title: 'First', status: 'todo', priority: 'high' },
      }),
      createMockEntityObject({
        id: 'b',
        values: { title: 'Second', status: 'done', priority: 'high' },
      }),
      createMockEntityObject({
        id: 'c',
        values: { title: 'Third', status: 'todo', priority: 'low' },
      }),
    ]

    function renderRows(extra: Record<string, unknown> = {}) {
      const onToggleRow = vi.fn()
      render(
        <EntityBoardContainer
          design={createMockEntityDesign()}
          containerId='c1'
          fallbackTitle={(object) => object.id}
          objects={objects}
          statusField='status'
          rowField='priority'
          onToggleColumnCollapsed={vi.fn()}
          onToggleRowCollapsed={onToggleRow}
          collapseLabels={collapseLabels}
          {...extra}
        />
      )
      return onToggleRow
    }

    it('offers to fold a row and says which one', async () => {
      const onToggleRow = renderRows()
      const button = await screen.findByRole('button', {
        name: 'Collapse High',
      })
      expect(button).toHaveAttribute('aria-expanded', 'true')
      fireEvent.click(button)
      expect(onToggleRow).toHaveBeenCalledWith('high')
    })

    it('hides a folded row in every column and shows its count', async () => {
      renderRows({ collapsedRows: ['high'] })
      const button = await screen.findByRole('button', { name: 'Expand High' })
      expect(button).toHaveAttribute('aria-expanded', 'false')
      expect(button).toHaveTextContent('High2')
      expect(screen.queryByText('a')).toBeNull()
      expect(screen.queryByText('b')).toBeNull()
      // The low row is untouched.
      expect(screen.getByText('c')).toBeTruthy()

      const grid = button.closest<HTMLElement>('.grid')
      expect(grid?.style.gridTemplateRows).toBe('auto auto 1fr 1fr')
    })

    it('offers no row toggle without labels to name it', async () => {
      renderRows({ collapseLabels: undefined })
      await screen.findByText('High')
      expect(screen.queryByRole('button', { name: /High/ })).toBeNull()
    })

    it('keeps a dropped card in a folded row, at its end', async () => {
      const onMoveObject = vi.fn()
      renderRows({ collapsedRows: ['high'], onMoveObject })
      await screen.findByRole('button', { name: 'Expand High' })
      const cell = document.querySelector<HTMLElement>(
        '[data-row-id="high"]'
      ) as HTMLElement
      cell.getBoundingClientRect = () =>
        ({ top: 0, bottom: 100, left: 0, right: 100 }) as DOMRect
      const dataTransfer = {
        types: [
          'text/plain',
          'application/x-mochi-class-task',
          'application/x-mochi-id-c',
        ],
        getData: () => 'c',
        dropEffect: 'move',
      }
      // jsdom's drag events carry no pointer position, so set it by hand.
      const over = createEvent.dragOver(cell, { dataTransfer })
      Object.defineProperty(over, 'clientY', { value: 50 })
      fireEvent(cell, over)
      fireEvent.drop(cell, { dataTransfer })

      expect(onMoveObject).toHaveBeenCalled()
      const [objectId, column, place, row] = onMoveObject.mock.calls[0]
      expect([objectId, column, row]).toEqual(['c', 'todo', 'high'])
      // After "a", the one card the folded cell holds.
      expect(place).toEqual({ after: 'a' })
    })
  })

  it('drops a task into another ticket at the place shown, naming the new parent in the move', async () => {
    const design = createMockEntityDesign({
      classes: [
        createMockEntityClass({ id: 'ticket', name: 'Ticket' }),
        createMockEntityClass({ id: 'task', name: 'Task' }),
      ],
      fields: {
        ticket: [
          createMockEntityField({ id: 'title', name: 'Title', fieldtype: 'text' }),
          createMockEntityField({ id: 'status', name: 'Status', fieldtype: 'enumerated' }),
        ],
        task: [createMockEntityField({ id: 'title', name: 'Title', fieldtype: 'text' })],
      },
      hierarchy: { ticket: [''], task: ['ticket'] },
    })
    const objects = [
      createMockEntityObject({ id: 't1', class: 'ticket', rank: 'A', values: { title: 'First ticket', status: 'todo' } }),
      createMockEntityObject({ id: 't2', class: 'ticket', rank: 'B', values: { title: 'Second ticket', status: 'todo' } }),
      createMockEntityObject({ id: 'a1', class: 'task', parent: 't1', rank: 'C', values: { title: 'Moving task', status: 'todo' } }),
      createMockEntityObject({ id: 'b1', class: 'task', parent: 't2', rank: 'D', values: { title: 'Upper task', status: 'todo' } }),
      createMockEntityObject({ id: 'b2', class: 'task', parent: 't2', rank: 'E', values: { title: 'Lower task', status: 'todo' } }),
    ]
    const onMoveObject = vi.fn()
    const onReparentObject = vi.fn()
    const { container } = render(
      <EntityBoardContainer
        design={design}
        containerId='c1'
        fallbackTitle={(object) => object.id}
        objects={objects}
        statusField='status'
        onMoveObject={onMoveObject}
        onReparentObject={onReparentObject}
      />
    )
    await screen.findByText('Upper task')
    const card = (id: string) => container.querySelector(`[data-card-id="${id}"]`)!
    place(card('t2'), 100, 200)
    place(card('b1'), 160, 30)
    place(card('b2'), 196, 30)
    // The middle of the upper task, past its midpoint: below it, above the
    // lower one. A task cannot hold a task, so this is a place in the list.
    dragAt('dragOver', card('b1'), 182, 'a1', 'task')
    dragAt('drop', card('b1'), 182, 'a1', 'task')
    expect(onReparentObject).not.toHaveBeenCalled()
    expect(onMoveObject).toHaveBeenCalledWith('a1', '', { after: 'b1', before: 'b2' }, undefined, undefined, 't2', undefined)
  })

  it('names the card a drop lands above, whatever nested cards in the column hold lower keys', async () => {
    const design = createMockEntityDesign({
      classes: [
        createMockEntityClass({ id: 'ticket', name: 'Ticket' }),
        createMockEntityClass({ id: 'task', name: 'Task' }),
      ],
      fields: {
        ticket: [
          createMockEntityField({ id: 'title', name: 'Title', fieldtype: 'text' }),
          createMockEntityField({ id: 'status', name: 'Status', fieldtype: 'enumerated' }),
        ],
        task: [
          createMockEntityField({ id: 'title', name: 'Title', fieldtype: 'text' }),
          createMockEntityField({ id: 'status', name: 'Status', fieldtype: 'enumerated' }),
        ],
      },
      options: {
        ticket: { status: [createMockEntityOption({ id: 'todo', name: 'Version 2' })] },
        task: { status: [createMockEntityOption({ id: 'todo', name: 'Version 2' })] },
      },
      hierarchy: { ticket: [''], task: ['ticket'] },
    })
    // Two tasks of the lower ticket sort above everything, and the top card
    // shares its key with its own task.
    const objects = [
      createMockEntityObject({ id: 'prefetch', class: 'task', parent: 'performance', rank: 'aH', values: { title: 'Prefetch', status: 'todo' } }),
      createMockEntityObject({ id: 'library', class: 'task', parent: 'performance', rank: 'aI', values: { title: 'Library', status: 'todo' } }),
      createMockEntityObject({ id: 'air', class: 'ticket', rank: 'b3j', values: { title: 'Air', status: 'todo' } }),
      createMockEntityObject({ id: 'carrier', class: 'task', parent: 'air', rank: 'b3j', values: { title: 'Carrier', status: 'todo' } }),
      createMockEntityObject({ id: 'openid', class: 'ticket', rank: 'b3jV', values: { title: 'OpenID', status: 'todo' } }),
      createMockEntityObject({ id: 'performance', class: 'ticket', rank: 'b4Q', values: { title: 'Performance', status: 'todo' } }),
    ]
    const onMoveObject = vi.fn()
    const { container } = render(
      <EntityBoardContainer
        design={design}
        containerId='c1'
        fallbackTitle={(object) => object.id}
        objects={objects}
        statusField='status'
        onMoveObject={onMoveObject}
        onReparentObject={vi.fn()}
      />
    )
    await screen.findByText('Version 2')
    const card = (id: string) => container.querySelector(`[data-card-id="${id}"]`)!
    place(card('air'), 0, 100)
    place(card('openid'), 110, 40)
    place(card('performance'), 160, 100)
    // The top edge of the top card: above it.
    dragAt('dragOver', card('air'), 2, 'openid', 'ticket')
    dragAt('drop', card('air'), 2, 'openid', 'ticket')
    expect(onMoveObject).toHaveBeenCalledWith('openid', 'todo', { before: 'air' }, undefined, undefined, undefined, undefined)
  })

  it('takes the gap down and refuses the drop where a task cannot go, between top-level cards', async () => {
    const design = createMockEntityDesign({
      classes: [
        createMockEntityClass({ id: 'ticket', name: 'Ticket' }),
        createMockEntityClass({ id: 'task', name: 'Task' }),
      ],
      fields: {
        ticket: [createMockEntityField({ id: 'status', name: 'Status', fieldtype: 'enumerated' })],
        task: [createMockEntityField({ id: 'title', name: 'Title', fieldtype: 'text' })],
      },
      hierarchy: { ticket: [''], task: ['ticket'] },
    })
    const objects = [
      createMockEntityObject({ id: 't1', class: 'ticket', rank: 'A', values: { title: 'First ticket', status: 'todo' } }),
      createMockEntityObject({ id: 't2', class: 'ticket', rank: 'B', values: { title: 'Second ticket', status: 'todo' } }),
      createMockEntityObject({ id: 'a1', class: 'task', parent: 't1', rank: 'C', values: { title: 'Moving task', status: 'todo' } }),
      createMockEntityObject({ id: 'b1', class: 'task', parent: 't2', rank: 'D', values: { title: 'Upper task', status: 'todo' } }),
    ]
    const onMoveObject = vi.fn()
    const onReparentObject = vi.fn()
    const { container } = render(
      <EntityBoardContainer
        design={design}
        containerId='c1'
        fallbackTitle={(object) => object.id}
        objects={objects}
        statusField='status'
        onMoveObject={onMoveObject}
        onReparentObject={onReparentObject}
      />
    )
    await screen.findByText('Upper task')
    const card = (id: string) => container.querySelector(`[data-card-id="${id}"]`)!
    place(card('t1'), 0, 90)
    place(card('t2'), 100, 200)
    place(card('b1'), 160, 30)
    const gap = () => container.querySelector('[data-children="t2"] > [data-card-id="a1"]')
    dragAt('dragOver', card('b1'), 182, 'a1', 'task')
    expect(gap()).not.toBeNull()
    // The top edge of the first ticket: between top-level cards.
    const refused = dragAt('dragOver', card('t1'), 2, 'a1', 'task')
    expect(gap()).toBeNull()
    expect(refused.dropEffect).toBe('none')
    dragAt('drop', card('t1'), 2, 'a1', 'task')
    expect(onMoveObject).not.toHaveBeenCalled()
    expect(onReparentObject).not.toHaveBeenCalled()
  })
})

