// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: Apache-2.0

import { useCallback, useEffect, useRef, useState } from 'react'
import { moveItem } from '../lib/reorder'
import { useDragReorder, type UseDragReorderResult } from './use-drag-reorder'

export type UsePersistedReorderOptions<T> = {
  /** The list as it is on screen right now. */
  items: T[]
  /** Applied as the pointer crosses each slot, so the drag stays live. */
  setItems: (next: T[]) => void
  /**
   * Write the order somewhere it survives a reload. Called once per drag, with
   * the order the drag ended on. A rejection puts the list back.
   */
  save: (items: T[]) => Promise<unknown>
  /** Told about a rejected save, after the list has been put back. */
  onError?: (error: unknown) => void
  /** Set false to leave the list static, as `useDragReorder` does. */
  enabled?: boolean
}

export type UsePersistedReorderResult = UseDragReorderResult & {
  /** A save is in flight; the list is frozen until it settles. */
  saving: boolean
}

/**
 * Drag-to-reorder for a list that is already saved: the list moves as the
 * pointer travels but saves once, on release, and is frozen while that save is
 * in flight. A rollback restores the order the server last took, so gate adds
 * and removes on `saving`.
 */
export function usePersistedReorder<T>({
  items,
  setItems,
  save,
  onError,
  enabled = true,
}: UsePersistedReorderOptions<T>): UsePersistedReorderResult {
  const [saving, setSaving] = useState(false)

  // The order the drag ended on, read at commit time. The `onMove` calls have
  // all been made by then, but the `items` prop this render closed over is the
  // order the drag started from.
  const itemsRef = useRef(items)
  // The last order the server is known to hold, which is where a failed save
  // goes back to.
  const savedRef = useRef(items)
  const setItemsRef = useRef(setItems)
  const saveRef = useRef(save)
  const onErrorRef = useRef(onError)
  useEffect(() => {
    itemsRef.current = items
    setItemsRef.current = setItems
    saveRef.current = save
    onErrorRef.current = onError
  })

  const onMove = useCallback((from: number, to: number) => {
    const next = moveItem(itemsRef.current, from, to)
    itemsRef.current = next
    setItemsRef.current(next)
  }, [])

  const onCommit = useCallback(() => {
    const next = itemsRef.current
    const previous = savedRef.current
    setSaving(true)
    saveRef.current(next).then(
      () => {
        savedRef.current = next
        setSaving(false)
      },
      (error: unknown) => {
        itemsRef.current = previous
        setItemsRef.current(previous)
        setSaving(false)
        onErrorRef.current?.(error)
      }
    )
  }, [])

  const drag = useDragReorder({
    count: items.length,
    onMove,
    onCommit,
    enabled: enabled && !saving,
  })

  // Anything the caller does to the list that is not this drag — an upload
  // appending, a delete removing — is already on the server, so it becomes the
  // order a failed save goes back to. Frozen for the length of a drag and its
  // save, where the list on screen is ahead of the server rather than behind.
  useEffect(() => {
    if (!drag.isDragging && !saving) savedRef.current = items
  }, [items, drag.isDragging, saving])

  return { ...drag, saving }
}
