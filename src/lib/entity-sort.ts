// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: Apache-2.0

// One comparator for every object list in the object/class/field apps (crm,
// projects).

import { naturalCompare } from './utils'
import { rankCompare } from './rank'
import type { EntityObject, EntitySortState } from '../types/entity-object'

export function compareEntityObjects<TObject extends EntityObject>(
  a: TObject,
  b: TObject,
  sort?: EntitySortState | null,
): number {
  const sortField = sort?.field || 'rank'
  const sortDirection = sort?.direction || 'asc'
  const multiplier = sortDirection === 'asc' ? 1 : -1

  let aVal: string | number
  let bVal: string | number

  if (sortField === 'rank') {
    aVal = a.rank || ''
    bVal = b.rank || ''
  } else if (sortField === 'number') {
    aVal = a.number || 0
    bVal = b.number || 0
  } else if (sortField === 'created') {
    aVal = a.created || 0
    bVal = b.created || 0
  } else if (sortField === 'updated') {
    aVal = a.updated || 0
    bVal = b.updated || 0
  } else {
    const fieldId = sortField.startsWith('field:')
      ? sortField.slice(6)
      : sortField
    aVal = a.values[fieldId] || ''
    bVal = b.values[fieldId] || ''
  }

  if (typeof aVal === 'number' && typeof bVal === 'number') {
    return (aVal - bVal) * multiplier
  }
  // Rank keys are opaque fractional-index strings — compare BINARY (rankCompare),
  // never naturalCompare (case/accent-insensitive + numeric-aware reorders them
  // and lands dragged cards at the wrong slot, #53).
  if (sortField === 'rank') {
    return rankCompare(String(aVal), String(bVal)) * multiplier
  }
  return naturalCompare(String(aVal), String(bVal)) * multiplier
}

export function sortEntityObjects<TObject extends EntityObject>(
  objects: TObject[],
  sort?: EntitySortState | null,
): TObject[] {
  return [...objects].sort((a, b) => compareEntityObjects(a, b, sort))
}
