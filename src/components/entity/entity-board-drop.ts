// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: Apache-2.0

import type { EntityDesign, EntityObject } from '../../types/entity-object'

/**
 * Where a board drag would land if dropped now: onto a card, becoming its
 * child; into a card's children at a 1-based place; or between the column's
 * top-level cards.
 */
export type EntityBoardDropTarget =
  | { kind: 'on'; card: Element; id: string }
  | { kind: 'sibling'; parent: string; rank: number }
  | { kind: 'top' }

/** True when `y` is well inside `card`, clear of its top and bottom edges. */
function inMiddle(card: Element, y: number, share: number, cap: number) {
  const rect = card.getBoundingClientRect()
  const edge = Math.min(rect.height * share, cap)
  return y - rect.top > edge && rect.bottom - y > edge
}

/**
 * The 1-based place among the cards of `list` that `y` falls before, judged on
 * each card's midpoint. The dragged card's own gap is skipped, so the place
 * does not shift as the gap moves.
 */
function placeAmong(list: Element, y: number, dragged: string) {
  let index = 0
  for (const card of list.querySelectorAll(':scope > [data-card-id]')) {
    if (card.getAttribute('data-card-id') === dragged) continue
    const rect = card.getBoundingClientRect()
    if (y < rect.top + rect.height / 2) break
    index++
  }
  return index + 1
}

/**
 * Where the pointer at height `y` over `target` aims a drag of `dragged`, whose
 * parent is `parent`. `accepts` answers whether a card may take the dragged
 * object as its child.
 *
 * A card's children are a list, marked `data-children` with the card's id.
 * Anywhere in it - on a child or in the space between two - the drop goes
 * into the list at the place the pointer is at, except in the middle of a
 * child that may take the dragged object as its own child. A list whose card
 * may not take it is passed over for the card itself. Elsewhere a card takes a
 * drop in its middle, and its edges, like the space between cards, are between
 * the column's top-level cards.
 */
export function entityBoardDropTarget(
  target: Element,
  y: number,
  dragged: string,
  parent: string | undefined,
  accepts: (card: string) => boolean
): EntityBoardDropTarget {
  const list = target.closest('[data-children]')
  if (list) {
    const owner = list.getAttribute('data-children') || ''
    const card = target.closest('[data-card-id]')
    if (card && list.contains(card)) {
      const id = card.getAttribute('data-card-id') || ''
      if (id !== dragged && inMiddle(card, y, 0.35, 20) && accepts(id)) {
        return { kind: 'on', card, id }
      }
    }
    if (owner === parent || accepts(owner)) {
      return { kind: 'sibling', parent: owner, rank: placeAmong(list, y, dragged) }
    }
    const ownerCard = list.closest('[data-card-id]')
    return ownerCard
      ? entityBoardDropTarget(ownerCard, y, dragged, parent, accepts)
      : { kind: 'top' }
  }
  const card = target.closest('[data-card-id]')
  if (card) {
    const id = card.getAttribute('data-card-id') || ''
    if (id !== dragged && inMiddle(card, y, 0.2, 12) && accepts(id)) {
      return { kind: 'on', card, id }
    }
  }
  return { kind: 'top' }
}

/**
 * Whether an object of class `objectClass` may be dropped between a column's
 * top-level cards: one at the top level always may, and a child leaves its
 * parent for the top level, which the hierarchy has to allow. Any column but
 * the one for no value also sets the board's column field, which the class has
 * to hold, or the server refuses the move with "field not found".
 */
export function entityBoardTopAllowed(
  design: Pick<EntityDesign, 'fields' | 'hierarchy'>,
  objectClass: string,
  child: boolean,
  statusField: string,
  column: string
) {
  if (!child) return true
  if (!(design.hierarchy[objectClass] || []).includes('')) return false
  if (!column || !statusField) return true
  return (design.fields[objectClass] || []).some((f) => f.id === statusField)
}

/** What a drop on the board does to the dragged object. */
export type EntityBoardDropAction =
  | {
      kind: 'move'
      value: string
      rank?: number
      row?: string
      scope?: string
      promote?: boolean
      parent?: string
    }
  | { kind: 'reparent'; parent: string }

/** True when `id` sits somewhere under `ancestor`. */
function under(
  id: string,
  ancestor: string,
  objects: Record<string, EntityObject>
) {
  let current = objects[id]?.parent || ''
  for (let i = 0; current && i < 100; i++) {
    if (current === ancestor) return true
    current = objects[current]?.parent || ''
  }
  return false
}

/**
 * What dropping `dragged` does, from where the column says it landed: into a
 * card's children at a place (`parent` and `place`), onto a card (`on`), or
 * between the column's top-level cards (`column`, `rank` and `row`). `topRank`
 * turns a place among the column's top-level cards into the rank the server
 * expects. Null when the drop is not allowed.
 */
export function entityBoardDropAction(
  dragged: EntityObject,
  objects: Record<string, EntityObject>,
  design: Pick<EntityDesign, 'fields' | 'hierarchy'>,
  statusField: string,
  drop: {
    column: string
    rank?: number
    row?: string
    on?: string
    parent?: string
    place?: number
  },
  topRank: (rank?: number) => number | undefined
): EntityBoardDropAction | null {
  const allows = (parentClass: string) =>
    (design.hierarchy[dragged.class] || []).includes(parentClass)

  if (drop.parent && drop.place !== undefined) {
    if (dragged.parent === drop.parent) {
      return { kind: 'move', value: '', rank: drop.place, scope: drop.parent }
    }
    const parent = objects[drop.parent]
    if (!parent || !allows(parent.class)) return null
    if (drop.parent === dragged.id || under(drop.parent, dragged.id, objects))
      return null
    // The new parent and the place among its children in one move, so the
    // drop lands where the line showed rather than at the end.
    return {
      kind: 'move',
      value: '',
      rank: drop.place,
      scope: drop.parent,
      parent: drop.parent,
    }
  }

  if (drop.on) {
    if (drop.on === dragged.id || under(drop.on, dragged.id, objects))
      return null
    const target = objects[drop.on]
    if (!target || !allows(target.class)) return null
    return { kind: 'reparent', parent: drop.on }
  }

  const child = !!(dragged.parent && objects[dragged.parent])
  if (
    !entityBoardTopAllowed(design, dragged.class, child, statusField, drop.column)
  )
    return null
  return {
    kind: 'move',
    value: drop.column,
    rank: topRank(drop.rank),
    row: drop.row,
    ...(child ? { promote: true } : {}),
  }
}
