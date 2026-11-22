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

// The shell answers every read of key not yet answered. Waits on a timer so
// the hook's handling of the reply has run before the caller asserts.
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
    if (vi.isFakeTimers()) await vi.advanceTimersByTimeAsync(0)
    else await new Promise((resolve) => setTimeout(resolve, 0))
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

  // The value each storage.set wrote for key, oldest first.
  function writes(key: string) {
    return sent('storage.set', key).map((write) => JSON.parse(write.value!))
  }
  const add = (id: string) => (previous: string[]) => [...previous, id]

  it('applies a change made before the shell answers to the stored value, not the default', async () => {
    const { result } = renderHook(() => useShellStorage<string[]>('key', []))
    act(() => result.current[1](add('new')))
    // Shown at once, built on what the hook has.
    expect(result.current[0]).toEqual(['new'])
    expect(result.current[2]).toBe(false)
    // Nothing is written until the stored value is known: the default plus
    // one change would replace it.
    expect(writes('key')).toEqual([])
    await answer('key', JSON.stringify(['kept']))
    expect(result.current[0]).toEqual(['kept', 'new'])
    expect(result.current[2]).toBe(true)
    expect(writes('key')).toEqual([['kept', 'new']])
  })

  it('applies a change made before the shell answers to the default when nothing is stored', async () => {
    const { result } = renderHook(() =>
      useShellStorage<string[]>('key', ['default'])
    )
    act(() => result.current[1](add('new')))
    await answer('key', null)
    expect(result.current[0]).toEqual(['default', 'new'])
    expect(writes('key')).toEqual([['default', 'new']])
  })

  it('composes two changes in one event, each building on the last', async () => {
    const { result } = renderHook(() => useShellStorage('key', 0))
    await answer('key', '5')
    act(() => {
      result.current[1]((previous) => previous + 1)
      result.current[1]((previous) => previous + 1)
    })
    expect(result.current[0]).toBe(7)
    expect(writes('key')).toEqual([6, 7])
  })

  it('composes changes made before the shell answers, in the order made', async () => {
    const { result } = renderHook(() => useShellStorage<string[]>('key', []))
    act(() => {
      result.current[1](add('first'))
      result.current[1](add('second'))
    })
    await answer('key', JSON.stringify(['kept']))
    expect(result.current[0]).toEqual(['kept', 'first', 'second'])
    expect(writes('key')).toEqual([['kept', 'first', 'second']])
  })

  it('applies an early change once under StrictMode, and keeps it from the abandoned read', async () => {
    const { result } = renderHook(() => useShellStorage<string[]>('key', []), {
      reactStrictMode: true,
    })
    act(() => result.current[1](add('new')))
    // Both reads StrictMode made are answered with the value from before the
    // change: the second must not lay it back over the change.
    expect(sent('storage.get', 'key').length).toBeGreaterThan(1)
    await answer('key', JSON.stringify(['kept']))
    expect(result.current[0]).toEqual(['kept', 'new'])
    expect(writes('key')).toEqual([['kept', 'new']])
  })

  it('lets a whole value set after an early change replace it', async () => {
    const { result } = renderHook(() => useShellStorage<string[]>('key', []))
    act(() => result.current[1](add('new')))
    act(() => result.current[1](['whole']))
    await answer('key', JSON.stringify(['kept']))
    expect(result.current[0]).toEqual(['whole'])
    expect(writes('key')).toEqual([['whole']])
  })

  it('keeps an early change to a key the hook has moved off, and shows only the new key', async () => {
    const { result, rerender } = renderHook(
      ({ key }) => useShellStorage<string[]>(key, []),
      { initialProps: { key: 'first' } }
    )
    act(() => result.current[1](add('one')))
    rerender({ key: 'second' })
    act(() => result.current[1](add('two')))
    await answer('first', JSON.stringify(['a']))
    // The first key's answer is written back but not shown on the second.
    expect(result.current[0]).toEqual(['one', 'two'])
    await answer('second', JSON.stringify(['b']))
    expect(writes('first')).toEqual([['a', 'one']])
    expect(writes('second')).toEqual([['b', 'two']])
    expect(result.current[0]).toEqual(['b', 'two'])
  })

  it('falls back on the default given with the key a change was made under', async () => {
    const { result, rerender } = renderHook(
      ({ key, fallback }) => useShellStorage<string[]>(key, fallback),
      { initialProps: { key: 'first', fallback: ['first'] } }
    )
    await answer('first', null)
    rerender({ key: 'second', fallback: ['second'] })
    act(() => result.current[1](add('new')))
    await answer('second', null)
    expect(writes('second')).toEqual([['second', 'new']])
  })

  it('reads a key with nothing stored as its default, not the last key the hook showed', async () => {
    const { result, rerender } = renderHook(
      ({ key }) => useShellStorage<string[]>(key, []),
      { initialProps: { key: 'first' } }
    )
    await answer('first', JSON.stringify(['a']))
    expect(result.current[0]).toEqual(['a'])
    rerender({ key: 'second' })
    await answer('second', null)
    expect(result.current[0]).toEqual([])
    act(() => result.current[1](add('new')))
    expect(writes('second')).toEqual([['new']])
  })

  it('keeps an early change when the component goes before the shell answers', async () => {
    const { result, unmount } = renderHook(() =>
      useShellStorage<string[]>('key', [])
    )
    act(() => result.current[1](add('new')))
    unmount()
    await answer('key', JSON.stringify(['kept']))
    expect(writes('key')).toEqual([['kept', 'new']])
  })

  // A read the shell does not answer in time says nothing of what is stored:
  // a change made before it is written only once a read of the key answers.
  describe('when a read is not answered in time', () => {
    beforeEach(() => {
      vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    })
    afterEach(() => {
      vi.useRealTimers()
    })

    // Runs timers one at a time (a read's timeout, the wait before asking
    // again) until `done`, or until none is left.
    async function step() {
      await act(async () => {
        await vi.advanceTimersToNextTimerAsync()
      })
    }
    async function until(done: () => boolean) {
      for (let count = 0; count < 50 && !done() && vi.getTimerCount(); count++)
        await step()
    }
    const reads = () => sent('storage.get', 'key').length

    it('keeps a change made before it queued, and applies it to the stored value once a later read answers', async () => {
      const { result } = renderHook(() => useShellStorage<string[]>('key', []))
      act(() => result.current[1](add('new')))
      await step() // the read times out
      expect(writes('key')).toEqual([])
      expect(result.current[2]).toBe(false)
      expect(result.current[0]).toEqual(['new'])
      await until(() => reads() > 1)
      expect(reads()).toBe(2) // asked again
      await answer('key', JSON.stringify(['kept']))
      expect(result.current[0]).toEqual(['kept', 'new'])
      expect(result.current[2]).toBe(true)
      expect(writes('key')).toEqual([['kept', 'new']])
    })

    it('keeps asking while it shows the key, past the back-off, with nothing written over it until an answer', async () => {
      const { result } = renderHook(() => useShellStorage<string[]>('key', []))
      act(() => result.current[1](add('new')))
      await until(() => reads() === 5) // the first read, three retries backing off, then one at the last interval
      // Past the back-off each read waits out its 2 s timeout and the last
      // interval, 4 s, before the next is sent: no storm.
      await act(async () => {
        await vi.advanceTimersByTimeAsync(5999)
      })
      expect(reads()).toBe(5)
      await act(async () => {
        await vi.advanceTimersByTimeAsync(1)
      })
      expect(reads()).toBe(6)
      expect(vi.getTimerCount()).toBeGreaterThan(0)
      expect(writes('key')).toEqual([])
      expect(result.current[2]).toBe(false)
      expect(result.current[0]).toEqual(['new'])
      act(() => result.current[1](add('later')))
      expect(writes('key')).toEqual([]) // a change made after is queued too
      await answer('key', JSON.stringify(['kept']))
      expect(result.current[2]).toBe(true)
      expect(writes('key')).toEqual([['kept', 'new', 'later']])
    })

    it('stops asking for a component that went, once the back-off is spent', async () => {
      const { result, unmount } = renderHook(() =>
        useShellStorage<string[]>('key', [])
      )
      act(() => result.current[1](add('new')))
      unmount()
      await until(() => false)
      expect(vi.getTimerCount()).toBe(0)
      expect(reads()).toBe(4) // the first read and three retries
      expect(writes('key')).toEqual([])
    })

    it('applies the change once under StrictMode, both reads having timed out', async () => {
      const { result } = renderHook(() => useShellStorage<string[]>('key', []), {
        reactStrictMode: true,
      })
      act(() => result.current[1](add('new')))
      const first = reads()
      expect(first).toBeGreaterThan(1)
      await until(() => reads() >= 2 * first)
      expect(writes('key')).toEqual([])
      await answer('key', JSON.stringify(['kept']))
      expect(result.current[0]).toEqual(['kept', 'new'])
      expect(writes('key')).toEqual([['kept', 'new']])
    })

    it('keeps asking for a change made before the component went', async () => {
      const { result, unmount } = renderHook(() =>
        useShellStorage<string[]>('key', [])
      )
      act(() => result.current[1](add('new')))
      unmount()
      await until(() => reads() > 1)
      expect(writes('key')).toEqual([])
      await answer('key', JSON.stringify(['kept']))
      expect(writes('key')).toEqual([['kept', 'new']])
    })
  })
})
