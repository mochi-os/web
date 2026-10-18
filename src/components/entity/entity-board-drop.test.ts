// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: Apache-2.0

import { describe, it, expect } from 'vitest'
import type { EntityDesign, EntityObject } from '../../types/entity-object'
import {
  entityBoardDropAction,
  entityBoardDropTarget,
  entityBoardTopAllowed,
} from './entity-board-drop'

/** Gives `el` a box `height` tall starting at `top`, as layout would. */
function place<T extends Element>(el: T, top: number, height: number): T {
  el.getBoundingClientRect = () =>
    ({
      top,
      bottom: top + height,
      height,
      left: 0,
      right: 200,
      width: 200,
      x: 0,
      y: top,
      toJSON: () => ({}),
    }) as DOMRect
  return el
}

function card(id: string, top: number, height: number) {
  const el = document.createElement('div')
  el.setAttribute('data-card-id', id)
  return place(el, top, height)
}

/**
 * A ticket card at 100-300 with a header and a list of its tasks: one at
 * 160-190, a 6px space, another at 196-226.
 */
function ticket() {
  const root = card('t2', 100, 200)
  const header = place(document.createElement('div'), 100, 50)
  header.textContent = 'Ticket'
  const list = place(document.createElement('div'), 155, 80)
  list.setAttribute('data-children', 't2')
  const first = card('b1', 160, 30)
  const second = card('b2', 196, 30)
  list.append(first, second)
  root.append(header, list)
  document.body.append(root)
  return { root, header, list, first, second }
}

describe('entityBoardDropTarget', () => {
  // A task may sit under a ticket but not under another task.
  const tickets = (id: string) => id === 't1' || id === 't2'

  it('places a drag in the middle of a task among the tasks, where a task cannot hold one', () => {
    const { first } = ticket()
    // 182 is past the first task's midpoint (175), in its middle third.
    expect(entityBoardDropTarget(first, 182, 'a1', 't1', tickets)).toEqual({
      kind: 'sibling',
      parent: 't2',
      rank: 2,
    })
    expect(entityBoardDropTarget(first, 168, 'a1', 't1', tickets)).toEqual({
      kind: 'sibling',
      parent: 't2',
      rank: 1,
    })
  })

  it('places a drag in the space between two tasks between them, not onto the ticket', () => {
    const { list } = ticket()
    expect(entityBoardDropTarget(list, 193, 'a1', 't1', tickets)).toEqual({
      kind: 'sibling',
      parent: 't2',
      rank: 2,
    })
    expect(entityBoardDropTarget(list, 232, 'a1', 't1', tickets)).toEqual({
      kind: 'sibling',
      parent: 't2',
      rank: 3,
    })
  })

  it('drops onto a task in its middle when a task may hold one', () => {
    const { first } = ticket()
    const anything = () => true
    const target = entityBoardDropTarget(first, 175, 'a1', 't1', anything)
    expect(target).toMatchObject({ kind: 'on', id: 'b1' })
  })

  it('drops onto a ticket in the middle of its header', () => {
    const { header } = ticket()
    expect(entityBoardDropTarget(header, 125, 'a1', 't1', tickets)).toMatchObject({
      kind: 'on',
      id: 't2',
    })
  })

  it('skips the dragged card’s own gap when placing it', () => {
    const { list, second } = ticket()
    const gap = card('a1', 160, 30)
    list.insertBefore(gap, list.firstChild)
    second.remove()
    // Past the gap and past b1's midpoint: after b1, which is second only
    // when the gap is not counted.
    place(list.children[1] as Element, 196, 30)
    expect(entityBoardDropTarget(list, 230, 'a1', 't1', tickets)).toEqual({
      kind: 'sibling',
      parent: 't2',
      rank: 2,
    })
  })

  it('passes over a list whose card cannot take the drag, for the card itself', () => {
    const { list } = ticket()
    const nothing = () => false
    expect(entityBoardDropTarget(list, 193, 'a1', 't1', nothing)).toEqual({
      kind: 'top',
    })
  })

  it('reorders among its own siblings even where the parent could not take a newcomer', () => {
    const { list } = ticket()
    // b1 is the one dragged, so it is not counted: just above b2 is first.
    expect(entityBoardDropTarget(list, 193, 'b1', 't2', () => false)).toEqual({
      kind: 'sibling',
      parent: 't2',
      rank: 1,
    })
    expect(entityBoardDropTarget(list, 232, 'b1', 't2', () => false)).toEqual({
      kind: 'sibling',
      parent: 't2',
      rank: 2,
    })
  })
})

function object(
  id: string,
  objectClass: string,
  parent = '',
  values: Record<string, string> = {}
): EntityObject {
  return { id, class: objectClass, parent, rank: 'V', created: 0, updated: 0, values }
}

describe('entityBoardDropAction', () => {
  const design: Pick<EntityDesign, 'fields' | 'hierarchy'> = {
    fields: {
      ticket: [{ id: 'status' } as EntityDesign['fields'][string][number]],
      task: [],
    },
    hierarchy: { ticket: [''], task: ['ticket'] },
  }
  const objects: Record<string, EntityObject> = {
    t1: object('t1', 'ticket', '', { status: 'todo' }),
    t2: object('t2', 'ticket', '', { status: 'done' }),
    a1: object('a1', 'task', 't1'),
    b1: object('b1', 'task', 't2'),
  }
  const topRank = (rank?: number) => (rank === undefined ? rank : rank + 10)

  it('moves a task into another ticket at the place shown, in one move', () => {
    expect(
      entityBoardDropAction(objects.a1, objects, design, 'status', { column: 'done', parent: 't2', place: 1 }, topRank)
    ).toEqual({ kind: 'move', value: '', rank: 1, scope: 't2', parent: 't2' })
  })

  it('reorders a task within its own ticket without naming a parent', () => {
    expect(
      entityBoardDropAction(objects.b1, objects, design, 'status', { column: 'done', parent: 't2', place: 2 }, topRank)
    ).toEqual({ kind: 'move', value: '', rank: 2, scope: 't2' })
  })

  it('refuses a parent the hierarchy does not allow, or one under the dragged object', () => {
    expect(
      entityBoardDropAction(objects.a1, objects, design, 'status', { column: 'todo', parent: 'b1', place: 1 }, topRank)
    ).toBeNull()
    expect(
      entityBoardDropAction(objects.t1, objects, { ...design, hierarchy: { ...design.hierarchy, ticket: ['', 'task'] } }, 'status', { column: 'todo', parent: 'a1', place: 1 }, topRank)
    ).toBeNull()
  })

  it('makes a task the child of a card dropped onto', () => {
    expect(
      entityBoardDropAction(objects.a1, objects, design, 'status', { column: 'done', on: 't2' }, topRank)
    ).toEqual({ kind: 'reparent', parent: 't2' })
  })

  it('does nothing with a task dropped between top-level cards when tasks may not be top level', () => {
    expect(
      entityBoardDropAction(objects.a1, objects, design, 'status', { column: 'todo', rank: 1 }, topRank)
    ).toBeNull()
  })

  it('does nothing with a task dropped into a column when tasks have no column field', () => {
    const loose = { ...design, hierarchy: { ...design.hierarchy, task: ['', 'ticket'] } }
    expect(
      entityBoardDropAction(objects.a1, objects, loose, 'status', { column: 'todo', rank: 1 }, topRank)
    ).toBeNull()
    expect(
      entityBoardDropAction(objects.a1, objects, loose, 'status', { column: '', rank: 1 }, topRank)
    ).toEqual({ kind: 'move', value: '', rank: 11, row: undefined, promote: true })
  })

  it('promotes a child dropped between top-level cards where it may go, at the place shown', () => {
    const loose: Pick<EntityDesign, 'fields' | 'hierarchy'> = {
      fields: { ...design.fields, task: [{ id: 'status' } as EntityDesign['fields'][string][number]] },
      hierarchy: { ...design.hierarchy, task: ['', 'ticket'] },
    }
    expect(
      entityBoardDropAction(objects.a1, objects, loose, 'status', { column: 'todo', rank: 2, row: 'r' }, topRank)
    ).toEqual({ kind: 'move', value: 'todo', rank: 12, row: 'r', promote: true })
  })

  it('moves a top-level card between top-level cards', () => {
    expect(
      entityBoardDropAction(objects.t1, objects, design, 'status', { column: 'done', rank: 1 }, topRank)
    ).toEqual({ kind: 'move', value: 'done', rank: 11, row: undefined })
  })
})

describe('entityBoardTopAllowed', () => {
  const design: Pick<EntityDesign, 'fields' | 'hierarchy'> = {
    fields: { task: [] },
    hierarchy: { task: ['ticket'] },
  }

  it('always lets a top-level card go between top-level cards', () => {
    expect(entityBoardTopAllowed(design, 'task', false, 'status', 'todo')).toBe(true)
  })

  it('needs the hierarchy to allow a child at the top level, and the column field for a column', () => {
    expect(entityBoardTopAllowed(design, 'task', true, 'status', 'todo')).toBe(false)
    const top = { ...design, hierarchy: { task: ['', 'ticket'] } }
    expect(entityBoardTopAllowed(top, 'task', true, 'status', 'todo')).toBe(false)
    expect(entityBoardTopAllowed(top, 'task', true, 'status', '')).toBe(true)
  })
})
