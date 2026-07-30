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

describe('theme value rules', () => {
  it('accepts custom properties and rejects ordinary ones', async () => {
    const { isThemeProperty } = await import('./shell-bridge')
    expect(isThemeProperty('--primary-l')).toBe(true)
    expect(isThemeProperty('--hue')).toBe(true)
    expect(isThemeProperty('display')).toBe(false)
    expect(isThemeProperty('pointer-events')).toBe(false)
    expect(isThemeProperty('font-size')).toBe(false)
  })

  it('rejects every value that was verified fetching in a browser', async () => {
    const { isFetchingValue } = await import('./shell-bridge')
    for (const value of [
      'url(https://evil.example/beacon)',
      'url(/themes/waves.svg)',
      'url(h\\74tp://evil.example/x)',
      '\\75rl(http://evil.example/x)',
      "image-set('https://evil.example/x' 1x)",
      "-webkit-image-set(url('https://evil.example/x') 1x)",
      'u/*x*/rl(https://evil.example/x)',
    ]) {
      expect(isFetchingValue(value)).toBe(true)
    }
    // Legitimate theme values must survive, or the filter has eaten the feature.
    for (const value of [
      '0.55',
      '100% 420px',
      'radial-gradient(ellipse at top, color-mix(in oklch, var(--primary) 12%, transparent), transparent 70%)',
      '0 1px 2px rgba(0, 0, 0, 0.1)',
    ]) {
      expect(isFetchingValue(value)).toBe(false)
    }
  })

  it('bounds font-size to a usable range', async () => {
    const { isThemeFontSize } = await import('./shell-bridge')
    expect(isThemeFontSize('87.5%')).toBe(true)
    expect(isThemeFontSize('100%')).toBe(true)
    expect(isThemeFontSize('125%')).toBe(true)
    // Content-hiding and chrome-hiding values, and non-percentages.
    expect(isThemeFontSize('0.01%')).toBe(false)
    expect(isThemeFontSize('9999%')).toBe(false)
    expect(isThemeFontSize('1px')).toBe(false)
    expect(isThemeFontSize('inherit')).toBe(false)
  })

  // The shell is a plain script that cannot import this module, so its copy of
  // these rules is the one that drifts. This asserts the copies still agree
  // rather than trusting a comment to keep them in step.
  it('matches the shell script copy of the same rules', async () => {
    const { readFileSync } = await import('node:fs')
    const { resolve } = await import('node:path')
    // vitest runs with lib/web as the working directory.
    const shell = readFileSync(
      resolve(process.cwd(), '../../apps/menu/web/public/shell.js'), 'utf8')

    // The literals as they must appear in shell.js. Written out rather than
    // extracted so a change to either copy fails here loudly.
    expect(shell).toContain('/^--[A-Za-z0-9_-]+$/')
    expect(shell).toContain('/url|image|src|element|cross-fade|paint|\\\\|\\/\\*/i')
    expect(shell).toContain('n >= 50 && n <= 200')
    // And the rules must actually be applied, not merely defined.
    expect(shell).toContain('if (isFetchingValue(value)) continue')
    expect(shell).toContain('if (isFontSize(value)) install(key, value)')
  })
})
