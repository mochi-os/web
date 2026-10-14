// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: Apache-2.0

// The text the screen shows for one stored field value. The server stores ids
// for selects (the option id), people (the user id) and items (the object id),
// so anything that searches, exports or lists past values has to turn them
// back into names first, or it matches and prints ids nobody sees. Kept free of
// `t` calls: a string here would land in every app's catalog.

import type {
  EntityChecklistItem,
  EntityField,
  EntityFieldOption,
} from '../types/entity-object'
import { decimalPlaces } from './locale-format'

export interface EntityDisplayContext {
  /** The field's options, for a select. */
  options?: EntityFieldOption[]
  /** User id to name. */
  people?: Record<string, string>
  /** Object id to title, for a field or entry that names another item. */
  objectTitle?: (id: string) => string | undefined
  formatDate?: (date: Date) => string
  formatNumber?: (value: number, decimals?: number) => string
}

/** Checkbox values arrive as '1' from the editor and 'true' from older peers. */
export function entityCheckboxChecked(value: string): boolean {
  return value === '1' || value === 'true'
}

/** A checklist value's items, or none when the stored JSON is not a list. */
export function entityChecklistItems(value: string): EntityChecklistItem[] {
  if (!value) return []
  try {
    const parsed: unknown = JSON.parse(value)
    return Array.isArray(parsed) ? (parsed as EntityChecklistItem[]) : []
  } catch {
    return []
  }
}

/**
 * What the screen shows for `raw` in `field`. A lookup that misses gives the
 * raw value back, so a deleted option still says something. An unchecked
 * checkbox and an empty value give ''.
 */
export function entityDisplayValue(
  field: Pick<EntityField, 'fieldtype'> | undefined,
  raw: string,
  ctx: EntityDisplayContext = {}
): string {
  if (!raw) return ''
  switch (field?.fieldtype) {
    case 'enumerated':
      return ctx.options?.find((o) => o.id === raw)?.name ?? raw
    case 'user':
      return ctx.people?.[raw] ?? raw
    case 'object':
      return ctx.objectTitle?.(raw) ?? raw
    case 'date': {
      if (!ctx.formatDate) return raw
      const date = new Date(raw + 'T00:00:00')
      return Number.isNaN(date.getTime()) ? raw : ctx.formatDate(date)
    }
    case 'number': {
      const numeric = Number(raw)
      if (!ctx.formatNumber || !Number.isFinite(numeric)) return raw
      return ctx.formatNumber(numeric, decimalPlaces(raw))
    }
    case 'checkbox':
      return entityCheckboxChecked(raw) ? '✓' : ''
    case 'checklist': {
      const items = entityChecklistItems(raw)
      if (items.length === 0) return ''
      return `${items.filter((i) => i.done).length}/${items.length}`
    }
    default:
      return raw
  }
}

/**
 * Everything a search should match for a checklist: its item texts, not the
 * done/total summary. Other types search their display value.
 */
export function entitySearchText(
  field: Pick<EntityField, 'fieldtype'> | undefined,
  raw: string,
  ctx: EntityDisplayContext = {}
): string {
  if (field?.fieldtype === 'checklist') {
    return entityChecklistItems(raw)
      .map((i) => (typeof i.text === 'string' ? i.text : ''))
      .join(' ')
  }
  if (field?.fieldtype === 'checkbox') return ''
  return entityDisplayValue(field, raw, ctx)
}
