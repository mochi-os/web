// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: Apache-2.0

import { afterEach, describe, expect, it, vi } from 'vitest'
import { subscribe } from './push'

// The server's key, and another the browser may have subscribed against.
const SERVER = 'BAECAwQ'
const OTHER = 'CQgHBgU'

function bytes(base64: string): ArrayBuffer {
  const raw = atob(base64.replace(/-/g, '+').replace(/_/g, '/') + '=')
  return Uint8Array.from(raw, (c) => c.charCodeAt(0)).buffer
}

function browser(existing: { key: ArrayBuffer | null } | null) {
  const unsubscribe = vi.fn(async () => true)
  const current = existing
    ? { options: { applicationServerKey: existing.key }, unsubscribe }
    : null
  const fresh = { options: { applicationServerKey: bytes(SERVER) } }
  const manager = {
    getSubscription: vi.fn(async () => current),
    subscribe: vi.fn(async () => fresh),
  }
  Object.defineProperty(navigator, 'serviceWorker', {
    configurable: true,
    value: {
      register: vi.fn(async () => ({ pushManager: manager })),
      ready: Promise.resolve(),
    },
  })
  Object.defineProperty(window, 'PushManager', {
    configurable: true,
    value: function PushManager() {},
  })
  return { manager, unsubscribe, current, fresh }
}

afterEach(() => {
  Reflect.deleteProperty(navigator, 'serviceWorker')
  Reflect.deleteProperty(window, 'PushManager')
})

describe('subscribe', () => {
  it('keeps a subscription made against the server key', async () => {
    const b = browser({ key: bytes(SERVER) })
    expect(await subscribe(SERVER)).toBe(b.current)
    expect(b.unsubscribe).not.toHaveBeenCalled()
    expect(b.manager.subscribe).not.toHaveBeenCalled()
  })

  it('replaces a subscription made against another key', async () => {
    const b = browser({ key: bytes(OTHER) })
    expect(await subscribe(SERVER)).toBe(b.fresh)
    expect(b.unsubscribe).toHaveBeenCalledOnce()
    expect(b.manager.subscribe).toHaveBeenCalledOnce()
  })

  it('keeps a subscription whose browser does not report its key', async () => {
    const b = browser({ key: null })
    expect(await subscribe(SERVER)).toBe(b.current)
    expect(b.unsubscribe).not.toHaveBeenCalled()
  })

  it('subscribes when there is no subscription', async () => {
    const b = browser(null)
    expect(await subscribe(SERVER)).toBe(b.fresh)
    expect(b.manager.subscribe).toHaveBeenCalledOnce()
  })
})
