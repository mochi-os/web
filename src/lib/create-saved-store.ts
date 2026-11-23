// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: Apache-2.0

// Synchronous mirror of the saved items each app stores server-side:
// `isSaved()` answers without awaiting, mutations apply optimistically and roll
// back on failure. A change made while a load is in flight is replayed over
// the list that load answers, which may have been read before the change
// reached the server. Call `loadSaved()` once after login. Messages stay
// MessageDescriptors, resolved at mutation time so a locale switch shows in the
// next toast.

import { i18n, type MessageDescriptor } from '@lingui/core'
import { toastAction } from './toast-action'
import { getErrorMessage } from './handle-server-error'

export interface SavedStoreMessages {
  saving: MessageDescriptor
  saved: MessageDescriptor
  addFailed: MessageDescriptor
  removing: MessageDescriptor
  removed: MessageDescriptor
  removeFailed: MessageDescriptor
  clearing: MessageDescriptor
  cleared: MessageDescriptor
  clearFailed: MessageDescriptor
}

export interface SavedStoreOptions<TItem, TInput> {
  /** Window event this store dispatches when the mirror changes. */
  eventName: string
  api: {
    list: () => Promise<TItem[]>
    add: (input: TInput) => Promise<unknown>
    remove: (id: string) => Promise<unknown>
    clear: () => Promise<unknown>
  }
  /** Id of a stored row. */
  itemId: (item: TItem) => string
  /** Id of the thing being saved, matched against `itemId`. */
  inputId: (input: TInput) => string
  /** The row to show immediately, before the server confirms it. */
  toItem: (input: TInput) => TItem
  /**
   * The saved list an add or remove answered, or null when the answer holds
   * none. Taken only when no other change has been made since.
   */
  answered?: (result: unknown) => TItem[] | null
  messages: SavedStoreMessages
}

export interface SavedStore<TItem, TInput> {
  getSaved: () => TItem[]
  isSaved: (id: string) => boolean
  loadSaved: () => Promise<void>
  addSaved: (input: TInput) => void
  removeSaved: (id: string) => void
  /** Returns the new state: true means the item is now saved. */
  toggleSaved: (input: TInput) => boolean
  clearSaved: () => void
  onSavedChange: (callback: () => void) => () => void
}

export function createSavedStore<TItem, TInput>({
  eventName,
  api,
  itemId,
  inputId,
  toItem,
  answered,
  messages,
}: SavedStoreOptions<TItem, TInput>): SavedStore<TItem, TInput> {
  let cache: TItem[] = []
  let inflight: Promise<void> | null = null
  // Changes made since the load in flight began, to replay over its answer.
  let pending: Array<(items: TItem[]) => TItem[]> = []
  let changes = 0

  const note = (change: (items: TItem[]) => TItem[]) => {
    changes += 1
    if (inflight) pending.push(change)
  }

  // Take the list a write answered, unless another change has followed it.
  const adopt = (result: unknown, at: number) => {
    if (!answered || changes !== at) return
    const items = answered(result)
    if (!items) return
    cache = items
    emit()
  }

  const without = (id: string) => (items: TItem[]) =>
    items.filter((item) => itemId(item) !== id)
  const including = (item: TItem) => (items: TItem[]) =>
    items.some((row) => itemId(row) === itemId(item)) ? items : [item, ...items]

  const emit = () => window.dispatchEvent(new Event(eventName))

  const getSaved = () => [...cache]
  const isSaved = (id: string) => cache.some((item) => itemId(item) === id)

  // Safe to call repeatedly; concurrent calls share one request. Failures are
  // swallowed so the bookmark UI degrades rather than throwing, and the
  // existing mirror is left untouched.
  const loadSaved = (): Promise<void> => {
    if (inflight) return inflight
    pending = []
    inflight = api
      .list()
      .then((items) => {
        cache = pending.reduce((rows, change) => change(rows), items)
        emit()
      })
      .catch(() => {})
      .finally(() => {
        inflight = null
        pending = []
      })
    return inflight
  }

  const addSaved = (input: TInput): void => {
    const id = inputId(input)
    if (isSaved(id)) return
    const item = toItem(input)
    cache = [item, ...cache]
    note(including(item))
    const at = changes
    emit()
    void toastAction(api.add(input), {
      loading: i18n._(messages.saving),
      success: i18n._(messages.saved),
      error: (e) => getErrorMessage(e, i18n._(messages.addFailed)),
    })
      .then((result) => adopt(result, at))
      .catch(() => {
        cache = without(id)(cache)
        note(without(id))
        emit()
      })
  }

  const removeSaved = (id: string): void => {
    const previous = cache.find((item) => itemId(item) === id)
    if (!previous) return
    cache = without(id)(cache)
    note(without(id))
    const at = changes
    emit()
    void toastAction(api.remove(id), {
      loading: i18n._(messages.removing),
      success: i18n._(messages.removed),
      error: (e) => getErrorMessage(e, i18n._(messages.removeFailed)),
    })
      .then((result) => adopt(result, at))
      .catch(() => {
        cache = including(previous)(cache)
        note(including(previous))
        emit()
      })
  }

  const toggleSaved = (input: TInput): boolean => {
    const id = inputId(input)
    if (isSaved(id)) {
      removeSaved(id)
      return false
    }
    addSaved(input)
    return true
  }

  const clearSaved = (): void => {
    const previous = cache
    cache = []
    note(() => [])
    emit()
    void toastAction(api.clear(), {
      loading: i18n._(messages.clearing),
      success: i18n._(messages.cleared),
      error: (e) => getErrorMessage(e, i18n._(messages.clearFailed)),
    }).catch(() => {
      cache = previous
      note(() => previous)
      emit()
    })
  }

  const onSavedChange = (callback: () => void): (() => void) => {
    const handler = () => callback()
    window.addEventListener(eventName, handler)
    return () => window.removeEventListener(eventName, handler)
  }

  return {
    getSaved,
    isSaved,
    loadSaved,
    addSaved,
    removeSaved,
    toggleSaved,
    clearSaved,
    onSavedChange,
  }
}
