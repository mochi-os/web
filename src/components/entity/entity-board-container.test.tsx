// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: Apache-2.0

import { describe, it, expect, vi } from 'vitest'
import {
  render,
  screen,
  fireEvent,
  createEvent,
  createMockEntityDesign,
  createMockEntityObject,
} from './entity-test-utils'
import { EntityBoardContainer } from './entity-board-container'

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
      const [objectId, column, , row] = onMoveObject.mock.calls[0]
      expect([objectId, column, row]).toEqual(['a', 'done', 'high'])
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
      const [objectId, column, rank, row] = onMoveObject.mock.calls[0]
      expect([objectId, column, row]).toEqual(['c', 'todo', 'high'])
      // After "a", the one card the folded cell holds.
      expect(rank).toBe(2)
    })
  })
})
