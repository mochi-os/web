// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: Apache-2.0

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// shell-storage only registers a pending resolver when isInShell() is true, so
// every test here simulates the sandboxed iframe the same way shell-bridge's
// suite does: parent !== window, and parent.document throws SecurityError.

let parentPostMessage: ReturnType<typeof vi.fn>
let parentStub: { postMessage: ReturnType<typeof vi.fn>; readonly document: never }

beforeEach(() => {
  parentPostMessage = vi.fn()
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
  Object.defineProperty(window, 'parent', {
    configurable: true,
    get() {
      return window
    },
  })
  vi.resetModules()
})

function dispatchFrom(source: unknown, data: unknown) {
  const event = new MessageEvent('message', { data })
  Object.defineProperty(event, 'source', { value: source, configurable: true })
  window.dispatchEvent(event)
}

// Reports what `promise` settled to, or 'PENDING' if it has not settled.
//
// getItem is an async function, so it returns an OUTER promise that adopts the
// inner one the listener resolves, and adoption costs extra microtask ticks.
// Racing against Promise.resolve() therefore reports 'PENDING' even when the
// value has leaked — an assertion that can never fail. Waiting on a real timer
// clears every microtask the adoption needs before the verdict is read.
const NOTHING = Symbol('nothing')
async function settledValue<T>(promise: Promise<T>): Promise<T | 'PENDING'> {
  let seen: T | typeof NOTHING = NOTHING
  void promise.then((value) => {
    seen = value
  })
  await new Promise((resolve) => setTimeout(resolve, 0))
  return seen === NOTHING ? 'PENDING' : (seen as T)
}

describe('shell-storage getItem', () => {
  it('asks the shell and resolves from its reply', async () => {
    const { getItem } = await import('./shell-storage')
    const pending = getItem('key')

    // Positive control: the read really did go out as a shell request, so a
    // "did not resolve" assertion below means the reply was refused rather
    // than that no request was ever registered.
    expect(parentPostMessage).toHaveBeenCalledTimes(1)
    const sent = parentPostMessage.mock.calls[0][0]
    expect(sent.type).toBe('storage.get')
    expect(sent.key).toBe('key')

    dispatchFrom(window.parent, { type: 'storage.result', id: sent.id, value: 'genuine' })
    expect(await pending).toBe('genuine')
  })

  it('ignores a reply forged by another window', async () => {
    const { getItem } = await import('./shell-storage')
    const pending = getItem('key')
    const sent = parentPostMessage.mock.calls[0][0]

    // A sibling frame or popup guessing the counter-based id.
    dispatchFrom({ name: 'not-the-shell' }, {
      type: 'storage.result',
      id: sent.id,
      value: 'forged',
    })
    expect(await settledValue(pending)).toBe('PENDING')

    // Still answerable by the real shell afterwards — the forged message must
    // not have consumed the pending resolver on its way to being ignored.
    dispatchFrom(window.parent, { type: 'storage.result', id: sent.id, value: 'genuine' })
    expect(await pending).toBe('genuine')
  })

  it('ignores a reply forged by the window itself', async () => {
    const { getItem } = await import('./shell-storage')
    const pending = getItem('key')
    const sent = parentPostMessage.mock.calls[0][0]

    dispatchFrom(window, { type: 'storage.result', id: sent.id, value: 'forged' })
    expect(await settledValue(pending)).toBe('PENDING')
  })

  it('ignores a message of another type from the shell', async () => {
    const { getItem } = await import('./shell-storage')
    const pending = getItem('key')
    const sent = parentPostMessage.mock.calls[0][0]

    dispatchFrom(window.parent, { type: 'init', id: sent.id, value: 'wrong-type' })
    expect(await settledValue(pending)).toBe('PENDING')
  })
})

// The direct (not-in-shell) path. The shell prefixes every key with
// `app:<name>:` before touching its own localStorage, so this path has to
// agree or the same logical value lands in two different slots depending on
// how the page was loaded, and two top-window apps collide on a bare key.
describe('storage keys are namespaced by app outside the shell', () => {
  beforeEach(() => {
    // Undo the outer stub: parent IS window here, so isInShell() is false and
    // these calls take the direct localStorage path rather than postMessage.
    Object.defineProperty(window, 'parent', {
      configurable: true,
      get() {
        return window
      },
    })
    localStorage.clear()
  })
  afterEach(() => {
    localStorage.clear()
    window.history.replaceState(null, '', '/')
  })

  function atPath(path: string) {
    window.history.replaceState(null, '', path)
  }

  it('writes under the same app: prefix the shell uses', async () => {
    const { getItem, setItem } = await import('./shell-storage')
    atPath('/feeds/')
    setItem('sidebar', 'open')
    // Exactly the shape shell.js builds: 'app:' + appName + ':' + key.
    expect(localStorage.getItem('app:feeds:sidebar')).toBe('open')
    expect(localStorage.getItem('sidebar')).toBeNull()
    expect(await getItem('sidebar')).toBe('open')
  })

  it('keeps two apps apart on the same key', async () => {
    const { getItem, setItem } = await import('./shell-storage')
    atPath('/feeds/')
    setItem('view', 'grid')
    atPath('/forums/')
    setItem('view', 'list')

    expect(await getItem('view')).toBe('list')
    atPath('/feeds/')
    expect(await getItem('view')).toBe('grid')
    // Before this both wrote the bare key 'view' and the second clobbered the
    // first - the collision the namespace exists to prevent.
    expect(localStorage.getItem('view')).toBeNull()
  })

  it('removes the namespaced key, not a bare one', async () => {
    const { getItem, setItem, removeItem } = await import('./shell-storage')
    atPath('/wikis/')
    setItem('draft', 'x')
    expect(localStorage.getItem('app:wikis:draft')).toBe('x')
    removeItem('draft')
    expect(localStorage.getItem('app:wikis:draft')).toBeNull()
    expect(await getItem('draft')).toBeNull()
  })
})
