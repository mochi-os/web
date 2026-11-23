// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: Apache-2.0

import type {
  EntityDesign,
  EntityObject,
  EntityPlace,
  EntitySortState,
} from '../../types/entity-object'

/**
 * Where a board drag would land if dropped now: onto a card, becoming its
 * child; into a card's children at a 1-based place; or between the column's
 * top-level cards.
 */
export type EntityBoardDropTarget =
  | { kind: 'on'; card: Element; id: string }
  | { kind: 'sibling'; parent: string; rank: number; place: EntityPlace }
  | { kind: 'top' }

/**
 * A drop as the column saw it: onto a card (`on`); into the children of
 * `parent` at `place`; or between the column's cards, in `row` when the board
 * has rows, at `place`.
 */
export interface EntityBoardDrop {
  place?: EntityPlace
  row?: string
  on?: string
  parent?: string
}

/** True when `y` is well inside `card`, clear of its top and bottom edges. */
function inMiddle(card: Element, y: number, share: number, cap: number) {
  const rect = card.getBoundingClientRect()
  const edge = Math.min(rect.height * share, cap)
  return y - rect.top > edge && rect.bottom - y > edge
}

/**
 * Where among `cards` a drop at height `y` lands, judged on each card's
 * midpoint: the 0-based index of the slot, and the cards directly after and
 * before it. The dragged card's own gap is skipped, so the slot does not shift
 * as the gap moves.
 */
export function entityBoardSlot(
  cards: Iterable<Element>,
  y: number,
  dragged: string
): { index: number; place: EntityPlace } {
  let index = 0
  const place: EntityPlace = {}
  for (const card of cards) {
    const id = card.getAttribute('data-card-id') || ''
    if (id === dragged) continue
    const rect = card.getBoundingClientRect()
    if (y < rect.top + rect.height / 2) {
      place.before = id
      break
    }
    place.after = id
    index++
  }
  return { index, place }
}

/**
 * Whether a board under `sort` draws its top-level cards in their keys'
 * order, the Manual sort, so a drop between two of them can land there.
 */
export function entityBoardOrdered(sort?: EntitySortState | null) {
  return (sort?.field || 'rank') === 'rank'
}

/**
 * The place a drop between a board's top-level cards asks the server for,
 * from `place`, the cards drawn directly above (`after`) and below
 * (`before`) it. The descending Manual sort draws the server's order exactly
 * reversed (see compareEntityObjects), so the card drawn above comes after
 * the one below in that order, and the two swap. Under any other sort the
 * cards are not drawn in key order and no place would show, so there is none.
 * A card's children are always drawn in ascending key order and take no part
 * in this.
 */
export function entityBoardPlace(
  place: EntityPlace | undefined,
  sort?: EntitySortState | null
): EntityPlace | undefined {
  if (!place || !entityBoardOrdered(sort)) return undefined
  if (sort?.direction !== 'desc') return place
  const swapped: EntityPlace = {}
  if (place.before) swapped.after = place.before
  if (place.after) swapped.before = place.after
  return swapped
}

/**
 * The place a drop just above (`before`) or below (`after`) the row `target`
 * asks for, among `rows`, the ids of the rows drawn in the target's list from
 * top to bottom: the rows drawn either side of the drop, past the dragged
 * row's own, swapped under the sort as entityBoardPlace swaps them. Undefined
 * for a target not among them, or under a sort other than Manual.
 */
export function entityListPlace(
  rows: readonly string[],
  dragged: string,
  target: string,
  position: 'before' | 'after',
  sort?: EntitySortState | null
): EntityPlace | undefined {
  const others = rows.filter((id) => id !== dragged)
  const index = others.indexOf(target)
  if (index < 0) return undefined
  const above = position === 'before' ? others[index - 1] : target
  const below = position === 'before' ? target : others[index + 1]
  const place: EntityPlace = {}
  if (above) place.after = above
  if (below) place.before = below
  return entityBoardPlace(place, sort)
}

/** The 1-based place among the cards of a children list, and its neighbours. */
function placeAmong(list: Element, y: number, dragged: string) {
  const slot = entityBoardSlot(
    list.querySelectorAll(':scope > [data-card-id]'),
    y,
    dragged
  )
  return { rank: slot.index + 1, place: slot.place }
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
      return { kind: 'sibling', parent: owner, ...placeAmong(list, y, dragged) }
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

/**
 * What a drop on the board does to the dragged object. A move's empty value
 * keeps its column; `clear` empties it, for a drop on the column for no value.
 */
export type EntityBoardDropAction =
  | {
      kind: 'move'
      value: string
      clear?: boolean
      place?: EntityPlace
      row?: string
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
 * What dropping `dragged` in `column` does, from where the column says it
 * landed (see EntityBoardDrop), with the board's top-level cards drawn under
 * `sort` (see entityBoardPlace). `columns` are the values the board draws a
 * column for: a drop between top-level cards in the column for no value
 * clears a value that is one of them, which would otherwise draw the card in
 * its own column still. `lanes` are likewise the values of `rowField` the
 * board draws a swimlane for, and a card whose value is none of them is drawn
 * in the lane for no value: a drop in the lane the card is drawn in names no
 * lane, since writing that lane's value would clear one no lane is drawn for.
 * Null when the drop is not allowed.
 */
export function entityBoardDropAction(
  dragged: EntityObject,
  objects: Record<string, EntityObject>,
  design: Pick<EntityDesign, 'fields' | 'hierarchy'>,
  statusField: string,
  column: string,
  drop: EntityBoardDrop,
  sort?: EntitySortState | null,
  columns: readonly string[] = [],
  rowField = '',
  lanes: readonly string[] = []
): EntityBoardDropAction | null {
  const allows = (parentClass: string) =>
    (design.hierarchy[dragged.class] || []).includes(parentClass)

  if (drop.parent) {
    if (dragged.parent === drop.parent) {
      return { kind: 'move', value: '', place: drop.place }
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
      place: drop.place,
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
  if (!entityBoardTopAllowed(design, dragged.class, child, statusField, column))
    return null
  const own = dragged.values[statusField] || ''
  const clear = !column && !!statusField && !!own && columns.includes(own)
  const lane = (rowField && dragged.values[rowField]) || ''
  const drawn = lanes.includes(lane) ? lane : ''
  return {
    kind: 'move',
    value: column,
    ...(clear ? { clear: true } : {}),
    place: entityBoardPlace(drop.place, sort),
    row: drop.row === drawn ? undefined : drop.row,
    ...(child ? { promote: true } : {}),
  }
}

/**
 * Whether an object of `objectClass` takes `value` for `fieldId` when a move or
 * a reparent cascades it from an ancestor, as the server decides: the class
 * has the field and the value is one the field accepts. Fields are per class,
 * so a child of another class may lack the field, or not offer the option, its
 * ancestor's move names. An empty value clears the field and always passes.
 */
export function entityCascadeAccepts(
  design: Pick<EntityDesign, 'fields' | 'options'>,
  objectClass: string,
  fieldId: string,
  value: string
) {
  const field = (design.fields[objectClass] || []).find((f) => f.id === fieldId)
  if (!field) return false
  if (!value) return true
  const number = (bound?: string) =>
    bound && /^-?\d+(\.\d+)?$/.test(bound) ? Number(bound) : undefined
  switch (field.fieldtype) {
    case 'enumerated':
      return (design.options[objectClass]?.[fieldId] || []).some(
        (o) => o.id === value
      )
    case 'checkbox':
      return ['0', '1', 'true', 'false'].includes(value)
    case 'number': {
      if (!/^-?\d+(\.\d+)?$/.test(value)) return false
      const minimum = number(field.min)
      const maximum = number(field.max)
      return (
        (minimum === undefined || Number(value) >= minimum) &&
        (maximum === undefined || Number(value) <= maximum)
      )
    }
    case 'date':
      return (
        /^\d{4}-\d{2}-\d{2}$/.test(value) &&
        (!field.min || value >= field.min) &&
        (!field.max || value <= field.max)
      )
    case 'text':
      return (
        (!field.minlength || value.length >= field.minlength) &&
        (!field.maxlength || value.length <= field.maxlength)
      )
    case 'user':
      return /^\w{49,51}$/.test(value)
    default:
      return true
  }
}

/**
 * `object` with those of `values` (field id to value) its class accepts
 * (entityCascadeAccepts), or the object itself when it takes none.
 */
export function entityCascade<TObject extends EntityObject>(
  design: Pick<EntityDesign, 'fields' | 'options'>,
  object: TObject,
  values: Record<string, string>
): TObject {
  let taken: Record<string, string> | undefined
  for (const [fieldId, value] of Object.entries(values)) {
    if ((object.values[fieldId] || '') === value) continue
    if (!entityCascadeAccepts(design, object.class, fieldId, value)) continue
    taken = { ...(taken ?? object.values), [fieldId]: value }
  }
  return taken ? { ...object, values: taken } : object
}

/**
 * The board column and row values a reparent copies from the new parent, for
 * every view's column and row field, as the server copies them; a field the
 * parent has no value for is cleared.
 */
export function entityParentValues(
  design: Pick<EntityDesign, 'views'>,
  parent: EntityObject
) {
  const values: Record<string, string> = {}
  for (const view of design.views) {
    if (view.columns) values[view.columns] = parent.values[view.columns] || ''
    if (view.rows) values[view.rows] = parent.values[view.rows] || ''
  }
  return values
}
