// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: Apache-2.0

import { describe, it, expect } from 'vitest'
import type {
  EntityDesign,
  EntityField,
  EntityObject,
} from '../../types/entity-object'
import {
  entityBoardDropAction,
  entityBoardDropTarget,
  entityBoardPlace,
  entityBoardSlot,
  entityBoardTopAllowed,
  entityCascade,
  entityCascadeAccepts,
  entityParentValues,
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

describe('entityBoardSlot', () => {
  // Three top-level cards a column shows, at 0-40, 50-90 and 100-140.
  const cards = () => [card('c1', 0, 40), card('c2', 50, 40), card('c3', 100, 40)]

  it('names the cards either side of the slot the pointer is in', () => {
    expect(entityBoardSlot(cards(), 10, 'x')).toEqual({ index: 0, place: { before: 'c1' } })
    expect(entityBoardSlot(cards(), 75, 'x')).toEqual({ index: 2, place: { after: 'c2', before: 'c3' } })
    expect(entityBoardSlot(cards(), 135, 'x')).toEqual({ index: 3, place: { after: 'c3' } })
    expect(entityBoardSlot([], 10, 'x')).toEqual({ index: 0, place: {} })
  })

  it('never names the dragged card, so its own gap is not a neighbour', () => {
    expect(entityBoardSlot(cards(), 75, 'c2')).toEqual({ index: 1, place: { after: 'c1', before: 'c3' } })
    expect(entityBoardSlot(cards(), 10, 'c1')).toEqual({ index: 0, place: { before: 'c2' } })
  })
})

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
      place: { after: 'b1', before: 'b2' },
    })
    expect(entityBoardDropTarget(first, 168, 'a1', 't1', tickets)).toEqual({
      kind: 'sibling',
      parent: 't2',
      rank: 1,
      place: { before: 'b1' },
    })
  })

  it('places a drag in the space between two tasks between them, not onto the ticket', () => {
    const { list } = ticket()
    expect(entityBoardDropTarget(list, 193, 'a1', 't1', tickets)).toEqual({
      kind: 'sibling',
      parent: 't2',
      rank: 2,
      place: { after: 'b1', before: 'b2' },
    })
    expect(entityBoardDropTarget(list, 232, 'a1', 't1', tickets)).toEqual({
      kind: 'sibling',
      parent: 't2',
      rank: 3,
      place: { after: 'b2' },
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
      place: { after: 'b1' },
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
      place: { before: 'b2' },
    })
    expect(entityBoardDropTarget(list, 232, 'b1', 't2', () => false)).toEqual({
      kind: 'sibling',
      parent: 't2',
      rank: 2,
      place: { after: 'b2' },
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
  it('moves a task into another ticket beside the task shown, in one move', () => {
    expect(
      entityBoardDropAction(objects.a1, objects, design, 'status', 'done', { parent: 't2', place: { before: 'b1' } })
    ).toEqual({ kind: 'move', value: '', place: { before: 'b1' }, parent: 't2' })
  })

  it('reorders a task within its own ticket without naming a parent', () => {
    expect(
      entityBoardDropAction(objects.b1, objects, design, 'status', 'done', { parent: 't2', place: {} })
    ).toEqual({ kind: 'move', value: '', place: {} })
  })

  it('refuses a parent the hierarchy does not allow, or one under the dragged object', () => {
    expect(
      entityBoardDropAction(objects.a1, objects, design, 'status', 'todo', { parent: 'b1', place: {} })
    ).toBeNull()
    expect(
      entityBoardDropAction(objects.t1, objects, { ...design, hierarchy: { ...design.hierarchy, ticket: ['', 'task'] } }, 'status', 'todo', { parent: 'a1', place: {} })
    ).toBeNull()
  })

  it('makes a task the child of a card dropped onto', () => {
    expect(
      entityBoardDropAction(objects.a1, objects, design, 'status', 'done', { on: 't2' })
    ).toEqual({ kind: 'reparent', parent: 't2' })
  })

  it('does nothing with a task dropped between top-level cards when tasks may not be top level', () => {
    expect(
      entityBoardDropAction(objects.a1, objects, design, 'status', 'todo', { place: { before: 't1' } })
    ).toBeNull()
  })

  it('does nothing with a task dropped into a column when tasks have no column field', () => {
    const loose = { ...design, hierarchy: { ...design.hierarchy, task: ['', 'ticket'] } }
    expect(
      entityBoardDropAction(objects.a1, objects, loose, 'status', 'todo', { place: { before: 't1' } })
    ).toBeNull()
    expect(
      entityBoardDropAction(objects.a1, objects, loose, 'status', '', { place: {} })
    ).toEqual({ kind: 'move', value: '', place: {}, row: undefined, promote: true })
  })

  it('promotes a child dropped between top-level cards where it may go, beside the card shown', () => {
    const loose: Pick<EntityDesign, 'fields' | 'hierarchy'> = {
      fields: { ...design.fields, task: [{ id: 'status' } as EntityDesign['fields'][string][number]] },
      hierarchy: { ...design.hierarchy, task: ['', 'ticket'] },
    }
    expect(
      entityBoardDropAction(objects.a1, objects, loose, 'status', 'todo', { place: { after: 't1' }, row: 'r' })
    ).toEqual({ kind: 'move', value: 'todo', place: { after: 't1' }, row: 'r', promote: true })
  })

  it('moves a top-level card beside the card it was dropped next to', () => {
    expect(
      entityBoardDropAction(objects.t1, objects, design, 'status', 'done', { place: { before: 't2' } })
    ).toEqual({ kind: 'move', value: 'done', place: { before: 't2' }, row: undefined })
  })

  it('asks for a key past the card drawn above when the Manual sort is descending', () => {
    expect(
      entityBoardDropAction(objects.t1, objects, design, 'status', 'done', { place: { after: 't2' } }, { field: 'rank', direction: 'desc' })
    ).toEqual({ kind: 'move', value: 'done', place: { before: 't2' }, row: undefined })
  })

  it('names no neighbour for a drop between top-level cards under another sort', () => {
    expect(
      entityBoardDropAction(objects.t1, objects, design, 'status', 'done', { place: { after: 't2' } }, { field: 'created', direction: 'asc' })
    ).toEqual({ kind: 'move', value: 'done', place: undefined, row: undefined })
  })

  it('keeps the place among a card’s children, which are drawn in key order under any sort', () => {
    expect(
      entityBoardDropAction(objects.a1, objects, design, 'status', 'done', { parent: 't2', place: { after: 'b1' } }, { field: 'rank', direction: 'desc' })
    ).toEqual({ kind: 'move', value: '', place: { after: 'b1' }, parent: 't2' })
  })

  describe('on the column for no value', () => {
    const columns = ['todo', 'done']
    const unset = object('u1', 'ticket')
    const stale = object('s1', 'ticket', '', { status: 'gone' })
    const all = { ...objects, u1: unset, s1: stale }

    it('clears the value of a card from another column, since an empty value keeps it', () => {
      expect(
        entityBoardDropAction(objects.t1, all, design, 'status', '', { place: { after: 'u1' } }, undefined, columns)
      ).toEqual({ kind: 'move', value: '', clear: true, place: { after: 'u1' }, row: undefined })
    })

    it('clears a child’s value as it promotes it there', () => {
      const loose: Pick<EntityDesign, 'fields' | 'hierarchy'> = {
        fields: { ...design.fields, task: [{ id: 'status' } as EntityDesign['fields'][string][number]] },
        hierarchy: { ...design.hierarchy, task: ['', 'ticket'] },
      }
      const child = object('c1', 'task', 't1', { status: 'todo' })
      expect(
        entityBoardDropAction(child, { ...all, c1: child }, loose, 'status', '', { place: {} }, undefined, columns)
      ).toEqual({ kind: 'move', value: '', clear: true, place: {}, row: undefined, promote: true })
    })

    it('reorders a card already there without clearing anything', () => {
      expect(
        entityBoardDropAction(unset, all, design, 'status', '', { place: { before: 's1' } }, undefined, columns)
      ).toEqual({ kind: 'move', value: '', place: { before: 's1' }, row: undefined })
    })

    it('reorders there a card whose value no column is drawn for without clearing it', () => {
      expect(
        entityBoardDropAction(stale, all, design, 'status', '', { place: { after: 'u1' } }, undefined, columns)
      ).toEqual({ kind: 'move', value: '', place: { after: 'u1' }, row: undefined })
    })

    it('clears nothing for a reorder among a card’s children', () => {
      const valued = object('v1', 'task', 't2', { status: 'done' })
      expect(
        entityBoardDropAction(valued, { ...all, v1: valued }, design, 'status', '', { parent: 't2', place: { after: 'b1' } }, undefined, columns)
      ).toEqual({ kind: 'move', value: '', place: { after: 'b1' } })
    })
  })
})

describe('entityBoardPlace', () => {
  it('keeps the place under the ascending Manual sort, or no sort', () => {
    const place = { after: 'a', before: 'b' }
    expect(entityBoardPlace(place, { field: 'rank', direction: 'asc' })).toEqual(place)
    expect(entityBoardPlace(place, null)).toEqual(place)
  })

  it('swaps the neighbours under the descending Manual sort', () => {
    expect(entityBoardPlace({ after: 'a', before: 'b' }, { field: 'rank', direction: 'desc' })).toEqual({ after: 'b', before: 'a' })
    // The last card of a list drawn in reverse holds the lowest key: a drop
    // at its end goes below it.
    expect(entityBoardPlace({ after: 'z' }, { field: 'rank', direction: 'desc' })).toEqual({ before: 'z' })
  })

  it('names no place under a sort other than Manual', () => {
    for (const field of ['created', 'updated', 'number', 'field:title']) {
      expect(entityBoardPlace({ after: 'a', before: 'b' }, { field, direction: 'asc' })).toBeUndefined()
    }
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

describe('entityCascadeAccepts', () => {
  const field = (id: string, fieldtype: string, extra: Partial<EntityField> = {}) =>
    ({ id, name: id, fieldtype, flags: '', multi: 0, rank: 0, card: 1, position: '', rows: 1, ...extra }) as EntityField
  const option = (id: string) => ({ id, name: id, colour: '', icon: '', rank: 0 })
  const design: Pick<EntityDesign, 'fields' | 'options'> = {
    fields: {
      task: [
        field('status', 'enumerated'),
        field('done', 'checkbox'),
        field('points', 'number', { min: '1', max: '10' }),
        field('due', 'date', { min: '2026-01-01' }),
        field('code', 'text', { minlength: 2, maxlength: 4 }),
        field('owner', 'user'),
      ],
      note: [],
    },
    options: { task: { status: [option('todo'), option('done')] } },
  }

  it('refuses a field the class does not have', () => {
    expect(entityCascadeAccepts(design, 'note', 'status', 'todo')).toBe(false)
    expect(entityCascadeAccepts(design, 'note', 'status', '')).toBe(false)
  })

  it('takes only what the field accepts', () => {
    expect(entityCascadeAccepts(design, 'task', 'status', 'done')).toBe(true)
    expect(entityCascadeAccepts(design, 'task', 'status', 'resolved')).toBe(false)
    expect(entityCascadeAccepts(design, 'task', 'status', '')).toBe(true)
    expect(entityCascadeAccepts(design, 'task', 'done', '1')).toBe(true)
    expect(entityCascadeAccepts(design, 'task', 'done', 'yes')).toBe(false)
    expect(entityCascadeAccepts(design, 'task', 'points', '5')).toBe(true)
    expect(entityCascadeAccepts(design, 'task', 'points', '11')).toBe(false)
    expect(entityCascadeAccepts(design, 'task', 'points', '1e3')).toBe(false)
    expect(entityCascadeAccepts(design, 'task', 'due', '2026-02-01')).toBe(true)
    expect(entityCascadeAccepts(design, 'task', 'due', '2025-12-31')).toBe(false)
    expect(entityCascadeAccepts(design, 'task', 'code', 'abc')).toBe(true)
    expect(entityCascadeAccepts(design, 'task', 'code', 'abcde')).toBe(false)
    expect(entityCascadeAccepts(design, 'task', 'owner', 'p'.repeat(50))).toBe(true)
    expect(entityCascadeAccepts(design, 'task', 'owner', 'x/-/delete?')).toBe(false)
  })

  it('gives an object only the values its class accepts, and keeps it when it takes none', () => {
    const task = { id: 't', class: 'task', parent: '', rank: 'V', created: 1, updated: 1, values: { status: 'todo' } }
    expect(entityCascade(design, task, { status: 'done', points: '99' }).values).toEqual({ status: 'done' })
    expect(entityCascade(design, task, { status: 'resolved' })).toBe(task)
    expect(entityParentValues(
      { views: [{ columns: 'status', rows: 'owner' } as EntityDesign['views'][number]] },
      { ...task, values: { status: 'done' } }
    )).toEqual({ status: 'done', owner: '' })
  })
})
