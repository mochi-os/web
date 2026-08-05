// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: Apache-2.0

// The sentinel is the whole point of this module: "the reader chose the all
// view" and "the reader has never opened anything" both have to survive a
// reload as distinct answers, which is why null is stored rather than dropped.

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { createLastEntityStorage } from './use-last-entity-storage'
import * as shellStorage from '../lib/shell-storage'

describe('createLastEntityStorage', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    window.localStorage.clear()
  })

  it('round-trips an entity id', async () => {
    const storage = createLastEntityStorage('mochi-test-last')
    storage.set('feed-1')
    await expect(storage.get()).resolves.toBe('feed-1')
  })

  it('reads back the all view as null', async () => {
    const storage = createLastEntityStorage('mochi-test-last')
    storage.set(null)
    await expect(storage.get()).resolves.toBeNull()
  })

  it('stores the all view rather than removing the key', async () => {
    const setItem = vi.spyOn(shellStorage, 'setItem')
    const storage = createLastEntityStorage('mochi-test-last')

    storage.set(null)

    expect(setItem).toHaveBeenCalledWith('mochi-test-last', 'all')
  })

  it('returns null when nothing was ever stored', async () => {
    const storage = createLastEntityStorage('mochi-test-unset')
    await expect(storage.get()).resolves.toBeNull()
  })

  it('forgets the entity on clear', async () => {
    const storage = createLastEntityStorage('mochi-test-last')
    storage.set('feed-1')
    storage.clear()
    await expect(storage.get()).resolves.toBeNull()
  })

  it('keeps each app on its own key', async () => {
    const feeds = createLastEntityStorage('mochi-feeds-last')
    const forums = createLastEntityStorage('mochi-forums-last')

    feeds.set('feed-1')
    forums.set('forum-9')

    await expect(feeds.get()).resolves.toBe('feed-1')
    await expect(forums.get()).resolves.toBe('forum-9')
  })
})
