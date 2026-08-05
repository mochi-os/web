// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: Apache-2.0

// The saved-items mirror feeds, forums and market each grew privately.
//
// Saved items live server-side in each app's own per-user DB, so they survive
// reloads and follow the reader between devices. The server does not annotate a
// row with a `saved` flag, so each app kept a synchronous in-memory mirror of
// that state: the UI can ask `isSaved()` without awaiting, mutations apply
// optimistically, and a failure rolls the mirror back. Call `loadSaved()` once
// after login to hydrate it.
//
// The three copies differed only in what a row is — feeds and forums store a
// post snapshot wrapped with its saved time, market stores the listing itself —
// so the row type and its id accessor are the app's, and so are the messages,
// which stay MessageDescriptors and are resolved at mutation time so a locale
// switch is reflected in the next toast.

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
  messages,
}: SavedStoreOptions<TItem, TInput>): SavedStore<TItem, TInput> {
  let cache: TItem[] = []
  let inflight: Promise<void> | null = null

  const emit = () => window.dispatchEvent(new Event(eventName))

  const getSaved = () => [...cache]
  const isSaved = (id: string) => cache.some((item) => itemId(item) === id)

  // Safe to call repeatedly; concurrent calls share one request. Failures are
  // swallowed so the bookmark UI degrades rather than throwing, and the
  // existing mirror is left untouched.
  const loadSaved = (): Promise<void> => {
    if (inflight) return inflight
    inflight = api
      .list()
      .then((items) => {
        cache = items
        emit()
      })
      .catch(() => {})
      .finally(() => {
        inflight = null
      })
    return inflight
  }

  const addSaved = (input: TInput): void => {
    const id = inputId(input)
    if (isSaved(id)) return
    cache = [toItem(input), ...cache]
    emit()
    void toastAction(api.add(input), {
      loading: i18n._(messages.saving),
      success: i18n._(messages.saved),
      error: (e) => getErrorMessage(e, i18n._(messages.addFailed)),
    }).catch(() => {
      cache = cache.filter((item) => itemId(item) !== id)
      emit()
    })
  }

  const removeSaved = (id: string): void => {
    const previous = cache.find((item) => itemId(item) === id)
    if (!previous) return
    cache = cache.filter((item) => itemId(item) !== id)
    emit()
    void toastAction(api.remove(id), {
      loading: i18n._(messages.removing),
      success: i18n._(messages.removed),
      error: (e) => getErrorMessage(e, i18n._(messages.removeFailed)),
    }).catch(() => {
      cache = [previous, ...cache]
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
    emit()
    void toastAction(api.clear(), {
      loading: i18n._(messages.clearing),
      success: i18n._(messages.cleared),
      error: (e) => getErrorMessage(e, i18n._(messages.clearFailed)),
    }).catch(() => {
      cache = previous
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
