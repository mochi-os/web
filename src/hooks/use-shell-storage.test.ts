// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: Apache-2.0

import { act, render, renderHook } from '@testing-library/react'
import { Activity, createElement, useEffect } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useShellStorage } from './use-shell-storage'

// The real shell-storage round trip: the hook runs in a simulated sandboxed
// iframe (parent !== window, parent.document throws SecurityError, as
// shell-storage's own suite does), so every read goes out as a storage.get
// to the parent and is answered by a storage.result message from it.

let parentPostMessage: ReturnType<typeof vi.fn>
const answered = new Set<number>()

beforeEach(() => {
  parentPostMessage = vi.fn()
  answered.clear()
  const parentStub = {
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
})

type Sent = { type: string; id?: number; key: string; value?: string }

function sent(type: string, key: string): Sent[] {
  return parentPostMessage.mock.calls
    .map((call) => call[0] as Sent)
    .filter((message) => message.type === type && message.key === key)
}

// The shell answers every read of key not yet answered. Waits on a real timer
// so the hook's handling of the reply has run before the caller asserts.
async function answer(key: string, value: string | null) {
  const reads = sent('storage.get', key).filter(
    (read) => !answered.has(read.id!)
  )
  expect(reads.length).toBeGreaterThan(0)
  await act(async () => {
    for (const read of reads) {
      answered.add(read.id!)
      const event = new MessageEvent('message', {
        data: { type: 'storage.result', id: read.id, value },
        origin: window.location.origin,
      })
      Object.defineProperty(event, 'source', { value: window.parent })
      window.dispatchEvent(event)
    }
    await new Promise((resolve) => setTimeout(resolve, 0))
  })
}

describe('useShellStorage', () => {
  it('says when the stored value has been read, so a caller need not act on the default', async () => {
    const { result } = renderHook(() => useShellStorage('key', ['default']))
    expect(result.current[0]).toEqual(['default'])
    expect(result.current[2]).toBe(false)
    await answer('key', JSON.stringify(['stored']))
    expect(result.current[2]).toBe(true)
    expect(result.current[0]).toEqual(['stored'])
  })

  it('counts nothing stored as read', async () => {
    const { result } = renderHook(() => useShellStorage('key', 1))
    await answer('key', null)
    expect(result.current[2]).toBe(true)
    expect(result.current[0]).toBe(1)
  })

  it('says unread again for a new key until that key is read', async () => {
    const { result, rerender } = renderHook(
      ({ key }) => useShellStorage(key, 0),
      { initialProps: { key: 'first' } }
    )
    await answer('first', '1')
    expect(result.current[2]).toBe(true)
    rerender({ key: 'second' })
    expect(result.current[2]).toBe(false)
  })

  it('keeps a value set before the shell answers, rather than laying the older stored one over it', async () => {
    const { result } = renderHook(() => useShellStorage('key', 'default'))
    // A second reader of the key that sets nothing: the positive control that
    // the reply really arrives and is applied.
    const other = renderHook(() => useShellStorage('key', 'default'))
    act(() => result.current[1]('loaded'))
    await answer('key', JSON.stringify('cached'))
    expect(other.result.current[0]).toBe('cached')
    expect(result.current[0]).toBe('loaded')
    expect(result.current[2]).toBe(true)
    expect(sent('storage.set', 'key')).toEqual([
      { type: 'storage.set', key: 'key', value: JSON.stringify('loaded') },
    ])
  })

  it('keeps a value set before the shell answers under StrictMode, whose first read is abandoned', async () => {
    const { result } = renderHook(() => useShellStorage('key', 'default'), {
      reactStrictMode: true,
    })
    const other = renderHook(() => useShellStorage('key', 'default'), {
      reactStrictMode: true,
    })
    act(() => result.current[1]('loaded'))
    await answer('key', JSON.stringify('cached'))
    expect(other.result.current[0]).toBe('cached')
    expect(result.current[0]).toBe('loaded')
  })

  it('lets a set under one key leave the reads of the keys after it alone', async () => {
    const { result, rerender } = renderHook(
      ({ key }) => useShellStorage(key, 'default'),
      { initialProps: { key: 'first' } }
    )
    act(() => result.current[1]('mine'))
    rerender({ key: 'second' })
    await answer('first', JSON.stringify('stale'))
    await answer('second', JSON.stringify('theirs'))
    expect(result.current[0]).toBe('theirs')
    // Back on the first key, its stored value is read and shown again.
    rerender({ key: 'first' })
    expect(result.current[2]).toBe(false)
    await answer('first', JSON.stringify('elsewhere'))
    expect(result.current[0]).toBe('elsewhere')
  })

  it('keeps a value set before its own read is asked for, and counts it known', async () => {
    // A child's effects run before its parent's, so the child sets the key
    // before the parent's hook has asked the shell for it.
    const seen: {
      current: [string, (value: string) => void, boolean] | null
    } = { current: null }
    function Child({ set }: { set: (value: string) => void }) {
      useEffect(() => set('early'), [set])
      return null
    }
    function Parent() {
      const state = useShellStorage('key', 'default')
      seen.current = state
      return createElement(Child, { set: state[1] })
    }
    render(createElement(Parent))
    expect(seen.current![0]).toBe('early')
    expect(seen.current![2]).toBe(true)
    await answer('key', JSON.stringify('stale'))
    expect(seen.current![0]).toBe('early')
    expect(seen.current![2]).toBe(true)
  })

  it('applies a later read of the key once the one a set overtook has answered', async () => {
    // Activity hides a component without dropping its state, and showing it
    // again runs its effects, so the same key is read a second time.
    const seen: {
      current: [string, (value: string) => void, boolean] | null
    } = { current: null }
    function Reader() {
      seen.current = useShellStorage('key', 'default')
      return null
    }
    const shown = (mode: 'visible' | 'hidden') =>
      createElement(Activity, { mode, children: createElement(Reader) })
    const view = render(shown('visible'))
    act(() => seen.current![1]('mine'))
    await answer('key', JSON.stringify('stale'))
    expect(seen.current![0]).toBe('mine')
    view.rerender(shown('hidden'))
    view.rerender(shown('visible'))
    await answer('key', JSON.stringify('elsewhere'))
    expect(seen.current![0]).toBe('elsewhere')
  })
})
