// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: Apache-2.0

import type { EntityChecklistItem } from '../../types/entity-object'

/**
 * The items of a checklist field's value, read as the Android client reads
 * them (Checklist.kt). Anything but a JSON array reads as none, and an item
 * that is not an object is skipped. An item with no id, or one repeating an
 * earlier id, is given one from its place in the list (`item-<index>`,
 * `<id>-<index>`), the same on every read, so an editor that reads the value
 * again on each render still finds the item it toggles. An item written with
 * `checked` rather than `done` reads it as done. Other keys are kept for the
 * next write to carry.
 */
export function checklistItems(
  value: string | null | undefined
): EntityChecklistItem[] {
  if (!value || !value.trim()) return []
  let root: unknown
  try {
    root = JSON.parse(value)
  } catch {
    return []
  }
  if (!Array.isArray(root)) return []
  const seen = new Set<string>()
  const items: EntityChecklistItem[] = []
  root.forEach((element: unknown, index) => {
    if (!element || typeof element !== 'object' || Array.isArray(element))
      return
    const { checked, ...item } = element as Record<string, unknown>
    let id = primitive(item.id)
    if (!id) id = `item-${index}`
    while (seen.has(id)) id = `${id}-${index}`
    seen.add(id)
    const done =
      typeof item.done === 'boolean'
        ? item.done
        : typeof checked === 'boolean'
          ? checked
          : false
    items.push({ ...item, id, text: primitive(item.text), done })
  })
  return items
}

/** A JSON string, number or boolean as its text; anything else as ''. */
function primitive(value: unknown): string {
  if (typeof value === 'string') return value
  if (typeof value === 'number' || typeof value === 'boolean')
    return String(value)
  return ''
}
