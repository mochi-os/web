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
function dispatchFromParent(data: unknown, origin: string = window.location.origin) {
  const event = new MessageEvent('message', { data, origin })
  Object.defineProperty(event, 'source', { value: window.parent, configurable: true })
  window.dispatchEvent(event)
}

describe('shell origin pinning', () => {
  it('accepts a message from the parent at the shell origin', async () => {
    const { shellRequestPermission } = await import('./shell-bridge')
    const promise = shellRequestPermission('accounts/read')
    const id = parentPostMessage.mock.calls[0][0].id
    dispatchFromParent({ type: 'permission-result', id, result: 'granted' })
    expect(await promise).toBe('granted')
  })

  it('ignores a message whose origin is not the shell origin', async () => {
    const { shellRequestPermission } = await import('./shell-bridge')
    const promise = shellRequestPermission('accounts/read')
    const id = parentPostMessage.mock.calls[0][0].id

    // Same source window, wrong origin. Measured in a sandboxed iframe without
    // allow-same-origin: event.origin on a parent-to-child message reads the
    // real origin, so this IS pinnable - the code used to accept any origin.
    dispatchFromParent({ type: 'permission-result', id, result: 'granted' }, 'https://evil.example')

    let settled = false
    void promise.then(() => { settled = true })
    await Promise.resolve()
    expect(settled).toBe(false)

    // and the genuine reply still lands
    dispatchFromParent({ type: 'permission-result', id, result: 'denied' })
    expect(await promise).toBe('denied')
  })
})

describe('shellRequestPermission', () => {
  it('sends correct postMessage to parent', async () => {
    const { shellRequestPermission } = await import('./shell-bridge')

    const promise = shellRequestPermission('accounts/read')

    expect(parentPostMessage).toHaveBeenCalledTimes(1)
    const msg = parentPostMessage.mock.calls[0][0]
    expect(msg.type).toBe('request-permission')
    expect(msg.permission).toBe('accounts/read')
    expect(typeof msg.id).toBe('number')
    // Neither is sent: the shell resolves the app itself and looks `restricted`
    // up on the server. A caller must never be able to name the app.
    expect(msg.app).toBeUndefined()
    expect(msg.restricted).toBeUndefined()
    // Pinned target origin, not '*'
    expect(parentPostMessage.mock.calls[0][1]).toBe(window.location.origin)

    // Simulate shell responding
    dispatchFromParent({ type: 'permission-result', id: msg.id, result: 'granted' })

    expect(await promise).toBe('granted')
  })

  it('resolves with denied when shell denies', async () => {
    const { shellRequestPermission } = await import('./shell-bridge')

    const promise = shellRequestPermission('accounts/read')
    const id = parentPostMessage.mock.calls[0][0].id

    dispatchFromParent({ type: 'permission-result', id, result: 'denied' })

    expect(await promise).toBe('denied')
  })

  it('does not send a restricted flag at all', async () => {
    const { shellRequestPermission } = await import('./shell-bridge')

    shellRequestPermission('user/read')

    const msg = parentPostMessage.mock.calls[0][0]
    expect(msg.restricted).toBeUndefined()
  })

  it('assigns unique IDs to concurrent requests', async () => {
    const { shellRequestPermission } = await import('./shell-bridge')

    shellRequestPermission('accounts/read')
    shellRequestPermission('groups/write')

    expect(parentPostMessage).toHaveBeenCalledTimes(2)
    const id1 = parentPostMessage.mock.calls[0][0].id
    const id2 = parentPostMessage.mock.calls[1][0].id
    expect(id1).not.toBe(id2)
  })

  it('resolves correct promise when multiple requests are pending', async () => {
    const { shellRequestPermission } = await import('./shell-bridge')

    const promise1 = shellRequestPermission('accounts/read')
    const promise2 = shellRequestPermission('groups/write')

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

    const promise = shellRequestPermission('accounts/read')
    const id = parentPostMessage.mock.calls[0][0].id

    // Send unrelated message
    dispatchFromParent({ type: 'subscribe-notifications-result', id, result: 'accepted' })

    // Now send the real one
    dispatchFromParent({ type: 'permission-result', id, result: 'granted' })

    expect(await promise).toBe('granted')
  })

  it('ignores messages whose source is not the parent window', async () => {
    const { shellRequestPermission } = await import('./shell-bridge')

    const promise = shellRequestPermission('accounts/read')
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

  // The trusted shell root is installed from the server's own resolution of the
  // preference, never from an app's posted values - a shell that installed them
  // could paint the permission dialog's text in its background colour.
  it('leaves the trusted shell root to the server instead of copying these rules', async () => {
    const { readFileSync } = await import('node:fs')
    const { resolve } = await import('node:path')
    // vitest runs with lib/web as the working directory.
    const shell = readFileSync(
      resolve(process.cwd(), '../../apps/menu/web/public/shell.js'), 'utf8')

    // The root is installed from the server's declarations, re-read whenever an
    // app reports that the preference changed.
    expect(shell).toContain('function applyThemeDeclarations')
    expect(shell).toContain('function refreshTheme')
    expect(shell).toContain('refreshTheme();')
    // And never from the reporting app's own values.
    expect(shell).not.toContain('applyThemeVars(data.colorTheme)')
    expect(shell).not.toContain('theme.overrides')
  })
})

describe('authenticatedUrl', () => {
  // Load the bridge and drive it to the initialised in-shell state, which is
  // the only state in which authenticatedUrl adds anything.
  async function loadInShell(token = 'test-token') {
    const bridge = await import('./shell-bridge')
    const ready = bridge.initShellBridge()
    dispatchFromParent({ type: 'init', token, inShell: true })
    await ready
    return bridge
  }

  it('appends the token to a same-origin path', async () => {
    const { authenticatedUrl } = await loadInShell()
    // Positive control: proves the in-shell state was reached at all, so a
    // later "unchanged" assertion means refusal rather than an inert bridge.
    expect(authenticatedUrl('/chat/abc/-/attachments/1')).toBe(
      '/chat/abc/-/attachments/1?token=test-token'
    )
  })

  it('keeps an existing query string', async () => {
    const { authenticatedUrl } = await loadInShell()
    expect(authenticatedUrl('/x?a=1')).toBe('/x?a=1&token=test-token')
  })

  it('percent-encodes the token', async () => {
    const { authenticatedUrl } = await loadInShell('a/b+c=d')
    expect(authenticatedUrl('/x')).toBe('/x?token=a%2Fb%2Bc%3Dd')
  })

  it('strips a Bearer prefix', async () => {
    const { authenticatedUrl } = await loadInShell('Bearer abc123')
    expect(authenticatedUrl('/x')).toBe('/x?token=abc123')
  })

  it('does not add the token to a protocol-relative URL', async () => {
    const { authenticatedUrl } = await loadInShell()
    expect(authenticatedUrl('//attacker.example/image')).toBe('//attacker.example/image')
  })

  it('does not add the token to an absolute foreign URL', async () => {
    const { authenticatedUrl } = await loadInShell()
    expect(authenticatedUrl('https://attacker.example/image')).toBe(
      'https://attacker.example/image'
    )
  })

  it('does not add the token to a non-HTTP scheme', async () => {
    const { authenticatedUrl } = await loadInShell()
    expect(authenticatedUrl('data:image/png;base64,AAAA')).toBe('data:image/png;base64,AAAA')
    expect(authenticatedUrl('javascript:alert(1)')).toBe('javascript:alert(1)')
  })

  it('returns the URL unchanged outside the shell', async () => {
    Object.defineProperty(window, 'parent', { configurable: true, get: () => window })
    const { authenticatedUrl } = await import('./shell-bridge')
    expect(authenticatedUrl('/chat/abc/-/attachments/1')).toBe('/chat/abc/-/attachments/1')
  })

  it('returns the URL unchanged when the shell supplied no token', async () => {
    const { authenticatedUrl } = await loadInShell('')
    expect(authenticatedUrl('/x')).toBe('/x')
  })
})

// The child stops waiting for `init` after 5s, but the shell's own ready
// watchdog is 10s — twice that — so init landing in the 5-10s window is
// ordinary, not pathological. Removing the listener at the timeout discarded
// it permanently and the app ran tokenless until the ten-minute refresh.
describe('initShellBridge', () => {
  it('accepts init that arrives before the timeout', async () => {
    const { initShellBridge } = await import('./shell-bridge')
    const pending = initShellBridge()
    dispatchFromParent({ type: 'init', token: 'early', inShell: true })
    await expect(pending).resolves.toMatchObject({ token: 'early', inShell: true })
  })

  it('resolves with an empty token when the shell never answers', async () => {
    vi.useFakeTimers()
    try {
      const { initShellBridge } = await import('./shell-bridge')
      const pending = initShellBridge()
      vi.advanceTimersByTime(5000)
      await expect(pending).resolves.toMatchObject({ token: '', inShell: true })
    } finally {
      vi.useRealTimers()
    }
  })

  it('still applies init that arrives after the timeout', async () => {
    vi.useFakeTimers()
    try {
      const { initShellBridge, getShellInitData } = await import('./shell-bridge')
      const pending = initShellBridge()
      vi.advanceTimersByTime(5000)
      const settled = await pending
      expect(settled.token).toBe('')

      dispatchFromParent({ type: 'init', token: 'late', inShell: true })

      // Visible through the cached accessor...
      expect(getShellInitData()?.token).toBe('late')
      // ...and through the object an earlier caller already holds, which is
      // the only way a component that awaited the promise sees it. The bridge
      // fills the resolved object in place for exactly that reason.
      expect(settled.token).toBe('late')
    } finally {
      vi.useRealTimers()
    }
  })

  it('ignores a late init that did not come from the shell', async () => {
    vi.useFakeTimers()
    try {
      const { initShellBridge, getShellInitData } = await import('./shell-bridge')
      const pending = initShellBridge()
      vi.advanceTimersByTime(5000)
      await pending

      // Same payload, but not stamped with the parent as its source.
      window.dispatchEvent(
        new MessageEvent('message', { data: { type: 'init', token: 'injected', inShell: true } }),
      )
      expect(getShellInitData()?.token).toBe('')
    } finally {
      vi.useRealTimers()
    }
  })
})
