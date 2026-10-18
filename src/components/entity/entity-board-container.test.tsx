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
    expect(onMoveObject).toHaveBeenCalledWith('a1', '', 2, undefined, 't2', undefined, 't2')
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

