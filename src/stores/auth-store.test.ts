// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: Apache-2.0

import { describe, it, expect, beforeEach } from 'vitest'
import { useAuthStore } from './auth-store'

// The avatar version token is what stops the menus answering an avatar change
// from the browser's five-minute HTTP cache: the avatar URL itself never
// changes, so the token is the only thing that makes the image refetch. It is
// persisted per identity so a reload inside the cache window stays fresh.

beforeEach(() => {
  localStorage.clear()
  useAuthStore.getState().clearAuth()
})

describe('auth store avatar version', () => {
  it('persists the version under the signed-in identity', () => {
    const store = useAuthStore.getState()
    store.setProfile('person-a', 'Person A')
    store.setAvatar('123')

    expect(useAuthStore.getState().avatar).toBe('123')
    expect(localStorage.getItem('avatar:person-a')).toBe('123')
  })

  it('hydrates a stored version when the identity loads', () => {
    localStorage.setItem('avatar:person-b', '456')
    useAuthStore.getState().setProfile('person-b', 'Person B')

    expect(useAuthStore.getState().avatar).toBe('456')
  })

  it('never hydrates another identity\'s stored version', () => {
    localStorage.setItem('avatar:person-b', '456')
    useAuthStore.getState().setProfile('person-a', 'Person A')

    expect(useAuthStore.getState().avatar).toBe('')
  })

  it('keeps a live version when nothing is stored', () => {
    // A version set before the identity is known (or where storage is
    // unavailable, as in a sandboxed iframe) must survive the identity load.
    const store = useAuthStore.getState()
    store.setAvatar('789')
    store.setProfile('person-c', 'Person C')

    expect(useAuthStore.getState().avatar).toBe('789')
    expect(localStorage.getItem('avatar:person-c')).toBeNull()
  })

  it('resets the live version on sign-out', () => {
    const store = useAuthStore.getState()
    store.setProfile('person-a', 'Person A')
    store.setAvatar('123')
    useAuthStore.getState().clearAuth()

    expect(useAuthStore.getState().avatar).toBe('')
  })
})
