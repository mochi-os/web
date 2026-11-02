// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: Apache-2.0

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
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

  it("never hydrates another identity's stored version", () => {
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

// The bridge stops waiting for init after 5 s and resolves with an empty
// token, but keeps listening. The store used to register its own listener
// only after that resolution, and only for token-refresh, so an init landing
// in the 5-10 s window (ordinary: the shell's ready watchdog is 10 s) left the
// app anonymous until the ten-minute refresh.
describe('auth store initialize in the shell', () => {
  let parentPostMessage: ReturnType<typeof vi.fn>
  let parentStub: {
    postMessage: ReturnType<typeof vi.fn>
    readonly document: never
  }

  beforeEach(() => {
    vi.useFakeTimers()
    vi.resetModules()
    parentPostMessage = vi.fn()
    parentStub = {
      postMessage: parentPostMessage,
      get document(): never {
        throw new DOMException('Blocked', 'SecurityError')
      },
    }
    Object.defineProperty(window, 'parent', {
      configurable: true,
      get: () => parentStub,
    })
  })

  afterEach(() => {
    Object.defineProperty(window, 'parent', {
      configurable: true,
      get: () => window,
    })
    vi.useRealTimers()
  })

  function fromShell(data: unknown) {
    const event = new MessageEvent('message', {
      data,
      origin: window.location.origin,
    })
    Object.defineProperty(event, 'source', {
      value: parentStub,
      configurable: true,
    })
    window.dispatchEvent(event)
  }

  it('learns the token from an init that arrives after the bridge gave up', async () => {
    const { useAuthStore: store } = await import('./auth-store')
    const initialized = store.getState().initialize()
    await vi.advanceTimersByTimeAsync(5_000)
    await initialized
    // Positive control: the deadline passed and the store is anonymous.
    expect(store.getState().isInitialized).toBe(true)
    expect(store.getState().token).toBe('')

    fromShell({ type: 'init', token: 'late-token', inShell: true })
    expect(store.getState().token).toBe('late-token')
    expect(store.getState().isAuthenticated).toBe(true)
  })
})

// The shell names who is signed in in its init, so the frame's page need not
// ask /_/identity behind a preflight of its own.
describe('auth store initialize: the identity comes with init', () => {
  let parentStub: { postMessage: () => void; readonly document: never }

  beforeEach(() => {
    vi.resetModules()
    parentStub = {
      postMessage: () => {},
      get document(): never {
        throw new DOMException('Blocked', 'SecurityError')
      },
    }
    Object.defineProperty(window, 'parent', {
      configurable: true,
      get: () => parentStub,
    })
  })

  afterEach(() => {
    Object.defineProperty(window, 'parent', {
      configurable: true,
      get: () => window,
    })
  })

  function fromShell(data: unknown) {
    const event = new MessageEvent('message', {
      data,
      origin: window.location.origin,
    })
    Object.defineProperty(event, 'source', {
      value: parentStub,
      configurable: true,
    })
    window.dispatchEvent(event)
  }

  it('takes the id and name, and the identity load then asks nothing', async () => {
    const { useAuthStore: store } = await import('./auth-store')
    const { authManager } = await import('../lib/auth-manager')
    const initialized = store.getState().initialize()
    fromShell({
      type: 'init',
      token: 'app-token',
      inShell: true,
      identity: { id: 'identity-alice', name: 'Alice' },
    })
    await initialized
    expect(store.getState().identity).toBe('identity-alice')
    expect(store.getState().name).toBe('Alice')

    const fetch = vi.fn()
    vi.stubGlobal('fetch', fetch)
    await authManager.loadIdentity(false)
    expect(fetch).not.toHaveBeenCalled()
    vi.unstubAllGlobals()
  })

  it('leaves them to /_/identity under a shell that sends none', async () => {
    const { useAuthStore: store } = await import('./auth-store')
    const initialized = store.getState().initialize()
    fromShell({ type: 'init', token: 'app-token', inShell: true })
    await initialized
    expect(store.getState().name).toBe('')
  })
})

// A page the server served to a request with no session says so, and the
// store then skips the /_/token request that could only be refused - a round
// trip before the page asked for any data.
describe('auth store initialize: a page served with no session', () => {
  let fetch: ReturnType<typeof vi.fn>

  beforeEach(() => {
    vi.resetModules()
    fetch = vi.fn(async () => ({
      ok: true,
      json: async () => ({ token: 'minted' }),
    }))
    vi.stubGlobal('fetch', fetch)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    document.head.querySelector('meta[name="mochi:anonymous"]')?.remove()
  })

  const minted = () =>
    fetch.mock.calls.filter(([url]) => String(url).includes('/_/token'))

  it('asks for no token when the page is marked', async () => {
    const meta = document.createElement('meta')
    meta.name = 'mochi:anonymous'
    meta.content = 'true'
    document.head.appendChild(meta)
    const { useAuthStore: store } = await import('./auth-store')
    await store.getState().initialize()
    expect(minted()).toEqual([])
    expect(store.getState().token).toBe('')
    expect(store.getState().isInitialized).toBe(true)
  })

  it('asks as before when the page is not marked', async () => {
    const { useAuthStore: store } = await import('./auth-store')
    await store.getState().initialize()
    expect(minted()).toHaveLength(1)
    expect(store.getState().token).toBe('minted')
  })
})
