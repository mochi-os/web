// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: Apache-2.0

// Synchronous mirror of the saved items each app stores server-side:
// `isSaved()` answers without awaiting, mutations apply optimistically and roll
// back on failure. A list the server answers, to a load or to a write, may
// have been read before a write still on its way reached the server, so the
// changes from the oldest write unanswered when the list was asked for are
// replayed over it. Call `loadSaved()` once after login. Messages stay
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
   * The saved list a write answered, or null when the answer holds none.
   * Taken only when no other change has been made since, with the writes
   * still on their way when it was sent replayed over it.
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
  type Change = (items: TItem[]) => TItem[]
  interface Entry {
    change: Change
    // Made by a write the server has not answered yet.
    open: boolean
  }

  let cache: TItem[] = []
  let inflight: Promise<void> | null = null
  // The changes made to the mirror, oldest first, log[0] being change number
  // `first`: kept from the oldest write still unanswered, and from where each
  // list still asked for replays (`asks`).
  let log: Entry[] = []
  let first = 0
  const asks: number[] = []

  // How many changes have been made.
  const count = () => first + log.length

  // Where a list asked for now replays from: the oldest write unanswered.
  const oldest = () => {
    const index = log.findIndex((entry) => entry.open)
    return first + (index === -1 ? log.length : index)
  }

  // Drop the changes no list could still need replayed.
  const trim = () => {
    const keep = Math.min(oldest(), ...asks) - first
    if (keep <= 0) return
    log = log.slice(keep)
    first += keep
  }

  // Note a change made to the mirror, `open` while its write is unanswered.
  const record = (change: Change, open: boolean): Entry => {
    const entry = { change, open }
    log.push(entry)
    trim()
    return entry
  }

  const settle = (entry: Entry) => {
    entry.open = false
    trim()
  }

  const ask = (): number => {
    const from = oldest()
    asks.push(from)
    return from
  }

  const release = (from: number) => {
    asks.splice(asks.indexOf(from), 1)
    trim()
  }

  // A list the server answered, with the changes from `from` on replayed.
  const replay = (items: TItem[], from: number): TItem[] =>
    log.slice(from - first).reduce((rows, entry) => entry.change(rows), items)

  // Take the list a write answered, unless another change has followed it.
  const adopt = (result: unknown, at: number, from: number) => {
    if (!answered || count() !== at) return
    const items = answered(result)
    if (!items) return
    cache = replay(items, from)
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
    const from = ask()
    inflight = api
      .list()
      .then((items) => {
        cache = replay(items, from)
        emit()
      })
      .catch(() => {})
      .finally(() => {
        inflight = null
        release(from)
      })
    return inflight
  }

  // Make a change and send the write that makes it on the server, which may
  // answer the saved list as it then stands; a failure makes `undo`.
  const write = (
    change: Change,
    undo: Change,
    send: () => Promise<unknown>,
    toasts: { loading: string; success: string; failed: string }
  ) => {
    cache = change(cache)
    const entry = record(change, true)
    const at = count()
    const from = ask()
    emit()
    // A send that throws rather than rejecting still settles its change.
    const sent = new Promise<unknown>((resolve) => resolve(send()))
    void toastAction(sent, {
      loading: toasts.loading,
      success: toasts.success,
      error: (e) => getErrorMessage(e, toasts.failed),
    })
      .then((result) => adopt(result, at, from))
      .catch(() => {
        cache = undo(cache)
        record(undo, false)
        emit()
      })
      .finally(() => {
        settle(entry)
        release(from)
      })
  }

  const addSaved = (input: TInput): void => {
    const id = inputId(input)
    if (isSaved(id)) return
    write(including(toItem(input)), without(id), () => api.add(input), {
      loading: i18n._(messages.saving),
      success: i18n._(messages.saved),
      failed: i18n._(messages.addFailed),
    })
  }

  const removeSaved = (id: string): void => {
    const previous = cache.find((item) => itemId(item) === id)
    if (!previous) return
    write(without(id), including(previous), () => api.remove(id), {
      loading: i18n._(messages.removing),
      success: i18n._(messages.removed),
      failed: i18n._(messages.removeFailed),
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
    write(
      () => [],
      () => previous,
      () => api.clear(),
      {
        loading: i18n._(messages.clearing),
        success: i18n._(messages.cleared),
        failed: i18n._(messages.clearFailed),
      }
    )
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
