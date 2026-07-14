// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: Apache-2.0

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// We must make isInShell() return true by simulating a sandboxed iframe.
// In jsdom, window.parent === window by default, so we override it.

let parentPostMessage: ReturnType<typeof vi.fn>
// Stable stub for window.parent. The bridge guards every inbound message on
// event.source === window.parent, so the stub must keep a stable identity and
// inbound MessageEvents must carry it as their source (see dispatchFromParent).
let parentStub: { postMessage: ReturnType<typeof vi.fn>; readonly document: never }

beforeEach(() => {
  parentPostMessage = vi.fn()

  // Simulate a sandboxed iframe: parent !== window, parent.document throws SecurityError
  parentStub = {
    postMessage: parentPostMessage,
    get document(): never {
      throw new DOMException('Blocked', 'SecurityError')
    },
  }
  Object.defineProperty(window, 'parent', {
    configurable: true,
    get() {
      return parentStub
    },
  })
})

afterEach(() => {
  // Restore parent to window (default jsdom)
  Object.defineProperty(window, 'parent', {
    configurable: true,
    get() {
      return window
    },
  })
  vi.resetModules()
})

// Dispatch a message as the shell would: stamped with source === window.parent.
// jsdom's MessageEvent constructor won't accept a non-Window source, so we
// override the property after construction.
function dispatchFromParent(data: unknown) {
  const event = new MessageEvent('message', { data })
  Object.defineProperty(event, 'source', { value: window.parent, configurable: true })
  window.dispatchEvent(event)
}

describe('shellRequestPermission', () => {
  it('sends correct postMessage to parent', async () => {
    const { shellRequestPermission } = await import('./shell-bridge')

    const promise = shellRequestPermission('feeds', 'accounts/read', false)

    expect(parentPostMessage).toHaveBeenCalledTimes(1)
    const msg = parentPostMessage.mock.calls[0][0]
    expect(msg.type).toBe('request-permission')
    expect(msg.app).toBe('feeds')
    expect(msg.permission).toBe('accounts/read')
    expect(msg.restricted).toBe(false)
    expect(typeof msg.id).toBe('number')

    // Simulate shell responding
    dispatchFromParent({ type: 'permission-result', id: msg.id, result: 'granted' })

    expect(await promise).toBe('granted')
  })

  it('resolves with denied when shell denies', async () => {
    const { shellRequestPermission } = await import('./shell-bridge')

    const promise = shellRequestPermission('feeds', 'accounts/read', false)
    const id = parentPostMessage.mock.calls[0][0].id

    dispatchFromParent({ type: 'permission-result', id, result: 'denied' })

    expect(await promise).toBe('denied')
  })

  it('sends restricted flag correctly', async () => {
    const { shellRequestPermission } = await import('./shell-bridge')

    shellRequestPermission('feeds', 'user/read', true)

    const msg = parentPostMessage.mock.calls[0][0]
    expect(msg.restricted).toBe(true)
  })

  it('assigns unique IDs to concurrent requests', async () => {
    const { shellRequestPermission } = await import('./shell-bridge')

    shellRequestPermission('feeds', 'accounts/read', false)
    shellRequestPermission('people', 'groups/manage', false)

    expect(parentPostMessage).toHaveBeenCalledTimes(2)
    const id1 = parentPostMessage.mock.calls[0][0].id
    const id2 = parentPostMessage.mock.calls[1][0].id
    expect(id1).not.toBe(id2)
  })

  it('resolves correct promise when multiple requests are pending', async () => {
    const { shellRequestPermission } = await import('./shell-bridge')

    const promise1 = shellRequestPermission('feeds', 'accounts/read', false)
    const promise2 = shellRequestPermission('people', 'groups/manage', false)

    const id1 = parentPostMessage.mock.calls[0][0].id
    const id2 = parentPostMessage.mock.calls[1][0].id

    // Respond to second first
    dispatchFromParent({ type: 'permission-result', id: id2, result: 'denied' })
    expect(await promise2).toBe('denied')

    // Then first
    dispatchFromParent({ type: 'permission-result', id: id1, result: 'granted' })
    expect(await promise1).toBe('granted')
  })

  it('ignores messages with non-matching type', async () => {
    const { shellRequestPermission } = await import('./shell-bridge')

    const promise = shellRequestPermission('feeds', 'accounts/read', false)
    const id = parentPostMessage.mock.calls[0][0].id

    // Send unrelated message
    dispatchFromParent({ type: 'subscribe-notifications-result', id, result: 'accepted' })

    // Now send the real one
    dispatchFromParent({ type: 'permission-result', id, result: 'granted' })

    expect(await promise).toBe('granted')
  })

  it('ignores messages whose source is not the parent window', async () => {
    const { shellRequestPermission } = await import('./shell-bridge')

    const promise = shellRequestPermission('feeds', 'accounts/read', false)
    const id = parentPostMessage.mock.calls[0][0].id

    // A message from some other window (sibling iframe, popup, embedded frame)
    // carries a different source and must be dropped by the bridge guard.
    const spoof = new MessageEvent('message', {
      data: { type: 'permission-result', id, result: 'granted' },
    })
    Object.defineProperty(spoof, 'source', { value: { notTheParent: true }, configurable: true })
    window.dispatchEvent(spoof)

    // The spoofed result must not resolve the promise.
    const settled = await Promise.race([promise, Promise.resolve('pending')])
    expect(settled).toBe('pending')

    // A genuine parent-sourced reply still resolves it.
    dispatchFromParent({ type: 'permission-result', id, result: 'granted' })
    expect(await promise).toBe('granted')
  })
})

describe('isInShell', () => {
  it('returns true when in a sandboxed iframe', async () => {
    const { isInShell } = await import('./shell-bridge')
    expect(isInShell()).toBe(true)
  })
})
