// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: Apache-2.0

import { QueryClient } from '@tanstack/react-query'
import { describe, expect, it, vi } from 'vitest'
import {
  applyNotificationsFrame,
  notificationsAfter,
} from './notification-frames'

const bell = (id: string, created: number, read = 0) => ({
  id,
  app: 'chat',
  topic: 'message',
  object: 'o1',
  content: `Message ${id}`,
  link: `/chat/${id}`,
  sender: 'sender-entity',
  count: 1,
  created,
  read,
})

// A frame lands in the list held, as a fetch would answer it: oldest first, a
// row sent again replacing the one held, a row the browser surface does not
// list left out. A frame that cannot be applied asks for the list again.
describe('notificationsAfter', () => {
  const held = [bell('a', 10), bell('c', 30)]

  it('puts a new row where its time puts it, with its sender', () => {
    const next = notificationsAfter(held, {
      type: 'new',
      web: true,
      ...bell('b', 20),
    })
    expect(next?.map((row) => row.id)).toEqual(['a', 'b', 'c'])
    expect(next?.[1].sender).toBe('sender-entity')
  })

  it('puts a row newer than every row held last', () => {
    const next = notificationsAfter(held, {
      type: 'new',
      web: true,
      ...bell('d', 40),
    })
    expect(next?.map((row) => row.id)).toEqual(['a', 'c', 'd'])
  })

  it('replaces a row sent again rather than listing it twice', () => {
    const next = notificationsAfter(held, {
      type: 'new',
      web: true,
      ...bell('a', 10),
      count: 3,
    })
    expect(next?.map((row) => [row.id, row.count])).toEqual([
      ['a', 3],
      ['c', 1],
    ])
  })

  it('moves a row sent again with a later time to where that time puts it', () => {
    const next = notificationsAfter(held, {
      type: 'new',
      web: true,
      ...bell('a', 35),
    })
    expect(next?.map((row) => row.id)).toEqual(['c', 'a'])
  })

  it('leaves out a row the surface does not list', () => {
    expect(
      notificationsAfter(held, { type: 'new', web: false, ...bell('b', 20) })
    ).toBe(held)
    expect(
      notificationsAfter(held, {
        type: 'new',
        web: false,
        ...bell('a', 10),
      })?.map((row) => row.id)
    ).toEqual(['c'])
  })

  it('asks for the list when the frame cannot say whether the surface lists it', () => {
    expect(notificationsAfter(held, { type: 'new', ...bell('b', 20) })).toBe(
      null
    )
  })

  it('marks one row, then every row, read', () => {
    const one = notificationsAfter(held, { type: 'read', id: 'c' })
    expect(one?.map((row) => Boolean(row.read))).toEqual([false, true])
    const every = notificationsAfter(held, { type: 'read_all' })
    expect(every?.every((row) => row.read > 0)).toBe(true)
  })

  it('leaves a row already read with the time it was read', () => {
    const list = [bell('a', 10, 5)]
    expect(notificationsAfter(list, { type: 'read', id: 'a' })?.[0].read).toBe(
      5
    )
    expect(notificationsAfter(list, { type: 'read_all' })?.[0].read).toBe(5)
  })

  it('asks for the list on a clear, which names no rows', () => {
    expect(notificationsAfter(held, { type: 'clear_object' })).toBeNull()
    expect(notificationsAfter(held, { type: 'clear_all' })).toBeNull()
  })
})

// The query the bell and the page hold: a frame applied in place where it can
// be, and the list fetched again where it cannot.
describe('applyNotificationsFrame', () => {
  const key = ['notifications', 'list']

  function holding(rows: ReturnType<typeof bell>[]) {
    const client = new QueryClient()
    client.setQueryData(key, { data: rows })
    const invalidate = vi.spyOn(client, 'invalidateQueries')
    const ids = () =>
      client
        .getQueryData<{ data: ReturnType<typeof bell>[] }>(key)
        ?.data.map((row) => row.id)
    return { client, invalidate, ids }
  }

  it('applies a frame it can take to the list held, fetching nothing', () => {
    const { client, invalidate, ids } = holding([bell('a', 10)])
    expect(
      applyNotificationsFrame(client, key, {
        type: 'new',
        web: true,
        ...bell('b', 20),
      })
    ).toBe(true)
    expect(ids()).toEqual(['a', 'b'])
    expect(invalidate).not.toHaveBeenCalled()
  })

  it('fetches the list for a frame it cannot take', () => {
    for (const frame of [
      { type: 'clear_all' },
      { type: 'clear_app' },
      { type: 'clear_object', changed: 2 },
      { type: 'categories' },
      { type: 'new', ...bell('b', 20) },
    ]) {
      const { client, invalidate } = holding([bell('a', 10)])
      expect(applyNotificationsFrame(client, key, frame)).toBe(true)
      expect(invalidate).toHaveBeenCalledWith({ queryKey: key })
    }
  })

  it('passes over a frame of another type, and a clear that changed no row', () => {
    for (const frame of [
      { type: 'socket/reopen' },
      { type: 'clear_object', changed: 0 },
      {},
    ]) {
      const { client, invalidate, ids } = holding([bell('a', 10)])
      expect(applyNotificationsFrame(client, key, frame)).toBe(false)
      expect(invalidate).not.toHaveBeenCalled()
      expect(ids()).toEqual(['a'])
    }
  })

  it('fetches the list rather than patching one a fetch under way will overwrite', async () => {
    const { client, invalidate, ids } = holding([bell('a', 10)])
    let land: (rows: unknown) => void = () => {}
    const fetching = client.fetchQuery({
      queryKey: key,
      queryFn: () => new Promise((resolve) => (land = resolve)),
    })
    applyNotificationsFrame(client, key, {
      type: 'new',
      web: true,
      ...bell('b', 20),
    })
    expect(invalidate).toHaveBeenCalledWith({ queryKey: key })
    expect(ids()).toEqual(['a'])
    land({ data: [bell('a', 10)] })
    await fetching.catch(() => {})
  })

  it('fetches the list when none is held', () => {
    const client = new QueryClient()
    const invalidate = vi.spyOn(client, 'invalidateQueries')
    expect(applyNotificationsFrame(client, key, { type: 'read_all' })).toBe(
      true
    )
    expect(invalidate).toHaveBeenCalledWith({ queryKey: key })
  })

  it('keeps the rest of the answer held beside the rows', () => {
    const client = new QueryClient()
    client.setQueryData(key, { data: [bell('a', 10)], extra: 1 })
    applyNotificationsFrame(client, key, { type: 'read_all' })
    expect(client.getQueryData<{ extra: number }>(key)?.extra).toBe(1)
  })
})
