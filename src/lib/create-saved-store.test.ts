// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: Apache-2.0

// Three apps carried this mirror privately and none had a test. What matters
// is the optimistic path: the mirror updates before the server answers, and a
// server failure has to put back exactly what was there.

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createSavedStore } from './create-saved-store'
import { msg } from '@lingui/core/macro'

interface Row {
  id: string
  name: string
}

const MESSAGES = {
  saving: msg`Saving...`,
  saved: msg`Saved`,
  addFailed: msg`Failed to save`,
  removing: msg`Removing...`,
  removed: msg`Removed from saved`,
  removeFailed: msg`Failed to remove`,
  clearing: msg`Clearing...`,
  cleared: msg`Cleared`,
  clearFailed: msg`Failed to clear`,
}

function makeStore() {
  const api = {
    list: vi
      .fn<() => Promise<Row[]>>()
      .mockResolvedValue([{ id: 'a', name: 'Alpha' }]),
    add: vi.fn<(input: Row) => Promise<unknown>>().mockResolvedValue({}),
    remove: vi.fn<(id: string) => Promise<unknown>>().mockResolvedValue({}),
    clear: vi.fn<() => Promise<unknown>>().mockResolvedValue({}),
  }
  const store = createSavedStore<Row, Row>({
    eventName: 'test:saved:changed',
    api,
    itemId: (item) => item.id,
    inputId: (input) => input.id,
    toItem: (input) => input,
    messages: MESSAGES,
  })
  return { store, api }
}

const flush = () => new Promise((resolve) => setTimeout(resolve, 0))

describe('createSavedStore', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('hydrates the mirror from list and notifies subscribers', async () => {
    const { store } = makeStore()
    const seen = vi.fn()
    store.onSavedChange(seen)

    await store.loadSaved()

    expect(store.getSaved()).toEqual([{ id: 'a', name: 'Alpha' }])
    expect(store.isSaved('a')).toBe(true)
    expect(seen).toHaveBeenCalled()
  })

  it('shares one request between concurrent loads', async () => {
    const { store, api } = makeStore()
    await Promise.all([store.loadSaved(), store.loadSaved()])
    expect(api.list).toHaveBeenCalledTimes(1)
  })

  it('leaves the mirror alone when the load fails', async () => {
    const { store, api } = makeStore()
    await store.loadSaved()
    api.list.mockRejectedValueOnce(new Error('offline'))

    await expect(store.loadSaved()).resolves.toBeUndefined()
    expect(store.getSaved()).toEqual([{ id: 'a', name: 'Alpha' }])
  })

  it('adds optimistically, before the server answers', () => {
    const { store, api } = makeStore()
    let resolveAdd: (value: unknown) => void = () => {}
    api.add.mockReturnValue(new Promise((r) => (resolveAdd = r)))

    store.addSaved({ id: 'b', name: 'Beta' })

    expect(store.isSaved('b')).toBe(true)
    resolveAdd({})
  })

  it('rolls the addition back when the server refuses', async () => {
    const { store, api } = makeStore()
    api.add.mockRejectedValue(new Error('refused'))

    store.addSaved({ id: 'b', name: 'Beta' })
    expect(store.isSaved('b')).toBe(true)

    await flush()
    expect(store.isSaved('b')).toBe(false)
  })

  it('puts a removed row back in place when the server refuses', async () => {
    const { store, api } = makeStore()
    await store.loadSaved()
    api.remove.mockRejectedValue(new Error('refused'))

    store.removeSaved('a')
    expect(store.isSaved('a')).toBe(false)

    await flush()
    expect(store.getSaved()).toEqual([{ id: 'a', name: 'Alpha' }])
  })

  it('restores the whole mirror when a clear fails', async () => {
    const { store, api } = makeStore()
    await store.loadSaved()
    api.clear.mockRejectedValue(new Error('refused'))

    store.clearSaved()
    expect(store.getSaved()).toEqual([])

    await flush()
    expect(store.getSaved()).toEqual([{ id: 'a', name: 'Alpha' }])
  })

  it('toggles both ways and reports the new state', async () => {
    const { store } = makeStore()
    await store.loadSaved()

    expect(store.toggleSaved({ id: 'a', name: 'Alpha' })).toBe(false)
    expect(store.isSaved('a')).toBe(false)

    expect(store.toggleSaved({ id: 'a', name: 'Alpha' })).toBe(true)
    expect(store.isSaved('a')).toBe(true)
  })

  it('ignores a second add of something already saved', async () => {
    const { store, api } = makeStore()
    await store.loadSaved()

    store.addSaved({ id: 'a', name: 'Alpha' })

    expect(api.add).not.toHaveBeenCalled()
    expect(store.getSaved()).toHaveLength(1)
  })

  it('hands back a copy, so callers cannot mutate the mirror', async () => {
    const { store } = makeStore()
    await store.loadSaved()

    store.getSaved().push({ id: 'x', name: 'Injected' })

    expect(store.getSaved()).toHaveLength(1)
  })

  it('stops notifying once unsubscribed', async () => {
    const { store } = makeStore()
    const seen = vi.fn()
    const unsubscribe = store.onSavedChange(seen)

    unsubscribe()
    await store.loadSaved()

    expect(seen).not.toHaveBeenCalled()
  })
})
