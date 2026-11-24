// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: Apache-2.0

// Three apps carried this mirror privately and none had a test. What matters
// is the optimistic path: the mirror updates before the server answers, and a
// server failure has to put back exactly what was there.

import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { MessageDescriptor } from '@lingui/core'
import { createSavedStore } from './create-saved-store'

interface Row {
  id: string
  name: string
}

// Descriptors are built by hand rather than with the msg macro on purpose.
// Every app extracts its catalogs from ../../../lib/web/src/**, test files
// included, so a macro here would push these fixtures into all 22 apps.
const fixture = (id: string): MessageDescriptor => ({ id, message: id })

const MESSAGES = {
  saving: fixture('test.saving'),
  saved: fixture('test.saved'),
  addFailed: fixture('test.add-failed'),
  removing: fixture('test.removing'),
  removed: fixture('test.removed'),
  removeFailed: fixture('test.remove-failed'),
  clearing: fixture('test.clearing'),
  cleared: fixture('test.cleared'),
  clearFailed: fixture('test.clear-failed'),
}

function makeStore(answered?: (result: unknown) => Row[] | null) {
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
    answered,
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

  describe('changes made while a load is in flight', () => {
    const deferredList = (api: ReturnType<typeof makeStore>['api']) => {
      let answer: (rows: Row[]) => void = () => {}
      api.list.mockReturnValueOnce(new Promise((r) => (answer = r)))
      return (rows: Row[]) => answer(rows)
    }

    it('keeps an addition the older list does not hold', async () => {
      const { store, api } = makeStore()
      const answer = deferredList(api)
      const loading = store.loadSaved()

      store.addSaved({ id: 'b', name: 'Beta' })
      answer([{ id: 'a', name: 'Alpha' }])
      await loading

      expect(store.isSaved('a')).toBe(true)
      expect(store.isSaved('b')).toBe(true)
    })

    it('keeps a removal the older list still holds', async () => {
      const { store, api } = makeStore()
      api.list.mockResolvedValueOnce([
        { id: 'a', name: 'Alpha' },
        { id: 'b', name: 'Beta' },
      ])
      await store.loadSaved()
      const answer = deferredList(api)
      const loading = store.loadSaved()

      store.removeSaved('a')
      answer([
        { id: 'a', name: 'Alpha' },
        { id: 'b', name: 'Beta' },
      ])
      await loading

      expect(store.isSaved('a')).toBe(false)
      expect(store.isSaved('b')).toBe(true)
    })

    it('keeps an addition still on its way when the load began', async () => {
      // The list is read before the addition reaches the server.
      const { store, api } = makeStore()
      let answerAdd: (value: unknown) => void = () => {}
      api.add.mockReturnValueOnce(new Promise((r) => (answerAdd = r)))
      store.addSaved({ id: 'b', name: 'Beta' })
      const answer = deferredList(api)
      const loading = store.loadSaved()

      answer([{ id: 'a', name: 'Alpha' }])
      await loading
      expect(store.isSaved('b')).toBe(true)

      answerAdd({})
      await flush()
      expect(store.isSaved('b')).toBe(true)
    })

    it('keeps a removal still on its way when the load began', async () => {
      const { store, api } = makeStore()
      await store.loadSaved()
      let answerRemove: (value: unknown) => void = () => {}
      api.remove.mockReturnValueOnce(new Promise((r) => (answerRemove = r)))
      store.removeSaved('a')
      const answer = deferredList(api)
      const loading = store.loadSaved()

      answer([{ id: 'a', name: 'Alpha' }])
      await loading
      expect(store.isSaved('a')).toBe(false)

      answerRemove({})
      await flush()
      expect(store.isSaved('a')).toBe(false)
    })

    it('undoes a write on its way when the load began that the server then refused', async () => {
      const { store, api } = makeStore()
      let refuse: (error: Error) => void = () => {}
      api.add.mockReturnValueOnce(new Promise((_, r) => (refuse = r)))
      store.addSaved({ id: 'b', name: 'Beta' })
      const answer = deferredList(api)
      const loading = store.loadSaved()

      refuse(new Error('refused'))
      await flush()
      answer([{ id: 'a', name: 'Alpha' }])
      await loading

      expect(store.isSaved('b')).toBe(false)
    })

    it('replays the changes after a write on its way in the order they were made', async () => {
      // Saved again after a removal the server has already answered.
      const { store, api } = makeStore()
      await store.loadSaved()
      let answerAdd: (value: unknown) => void = () => {}
      api.add.mockReturnValueOnce(new Promise((r) => (answerAdd = r)))
      store.addSaved({ id: 'b', name: 'Beta' })
      store.removeSaved('b')
      await flush()
      const answer = deferredList(api)
      const loading = store.loadSaved()

      answer([
        { id: 'a', name: 'Alpha' },
        { id: 'b', name: 'Beta' },
      ])
      await loading
      expect(store.isSaved('b')).toBe(false)
      answerAdd({})
    })

    it("takes the list's word on a write answered before it was asked for", async () => {
      // Saved here, then removed on another device before the load.
      const { store, api } = makeStore()
      store.addSaved({ id: 'b', name: 'Beta' })
      await flush()
      api.list.mockResolvedValueOnce([{ id: 'a', name: 'Alpha' }])

      await store.loadSaved()

      expect(store.isSaved('b')).toBe(false)
    })

    it('leaves out an addition the server refused', async () => {
      const { store, api } = makeStore()
      api.add.mockRejectedValue(new Error('refused'))
      const answer = deferredList(api)
      const loading = store.loadSaved()

      store.addSaved({ id: 'b', name: 'Beta' })
      await flush()
      answer([{ id: 'a', name: 'Alpha' }])
      await loading

      expect(store.isSaved('b')).toBe(false)
    })
  })

  describe('a list answered by a write', () => {
    const answered = (result: unknown) => {
      const saved = (result as { saved?: unknown } | null)?.saved
      return Array.isArray(saved) ? (saved as Row[]) : null
    }

    it('takes the list an addition answered', async () => {
      const { store, api } = makeStore(answered)
      api.add.mockResolvedValue({
        saved: [
          { id: 'b', name: 'Beta' },
          { id: 'c', name: 'Gamma' },
        ],
      })

      store.addSaved({ id: 'b', name: 'Beta' })
      await flush()

      expect(store.isSaved('c')).toBe(true)
    })

    it('takes the list a removal answered', async () => {
      const { store, api } = makeStore(answered)
      await store.loadSaved()
      api.remove.mockResolvedValue({ saved: [{ id: 'c', name: 'Gamma' }] })

      store.removeSaved('a')
      await flush()

      expect(store.getSaved().map((row) => row.id)).toEqual(['c'])
    })

    it('ignores an answered list a later change has overtaken', async () => {
      const { store, api } = makeStore(answered)
      let answerFirst: (value: unknown) => void = () => {}
      api.add
        .mockReturnValueOnce(new Promise((r) => (answerFirst = r)))
        .mockResolvedValueOnce({
          saved: [
            { id: 'c', name: 'Gamma' },
            { id: 'b', name: 'Beta' },
          ],
        })

      store.addSaved({ id: 'b', name: 'Beta' })
      store.addSaved({ id: 'c', name: 'Gamma' })
      await flush()
      answerFirst({ saved: [{ id: 'b', name: 'Beta' }] })
      await flush()

      expect(store.isSaved('c')).toBe(true)
    })

    it('keeps an earlier write still on its way over the list a later one answered', async () => {
      const { store, api } = makeStore(answered)
      await store.loadSaved()
      let answerFirst: (value: unknown) => void = () => {}
      api.add
        .mockReturnValueOnce(new Promise((r) => (answerFirst = r)))
        .mockResolvedValueOnce({
          saved: [
            { id: 'c', name: 'Gamma' },
            { id: 'a', name: 'Alpha' },
          ],
        })

      store.addSaved({ id: 'b', name: 'Beta' })
      store.addSaved({ id: 'c', name: 'Gamma' })
      await flush()

      expect(store.isSaved('b')).toBe(true)
      expect(store.isSaved('c')).toBe(true)
      answerFirst({})
    })

    it('keeps the mirror when the answer holds no list', async () => {
      const { store, api } = makeStore(answered)
      api.add.mockResolvedValue({ saved: true })

      store.addSaved({ id: 'b', name: 'Beta' })
      await flush()

      expect(store.isSaved('b')).toBe(true)
    })
  })
})
