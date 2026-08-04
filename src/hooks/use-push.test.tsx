// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: Apache-2.0

// The property under test is WHO ANSWERED. Push requests are matched on a fixed
// type string and an id from a plain counter, neither of which is a secret, so
// the only thing separating the shell's reply from one forged by a nested frame
// is event.source. Apps run sandboxed with an opaque origin, so event.origin
// serialises to "null" and cannot be pinned instead — the same reasoning the
// main bridge and the storage proxy record.
//
// Driven through usePush rather than the module-private helpers, so the guard is
// exercised on the path an app actually takes.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createElement, type ReactNode } from 'react'
import { usePush } from './use-push'

let parentPostMessage: ReturnType<typeof vi.fn>
let parentStub: { postMessage: ReturnType<typeof vi.fn> }

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return createElement(QueryClientProvider, { client }, children)
}

// A reply carrying the shell's identity, as the real parent's would.
function replyFromParent(data: unknown) {
  const event = new MessageEvent('message', { data })
  Object.defineProperty(event, 'source', { value: parentStub, configurable: true })
  window.dispatchEvent(event)
}

// The forgery: same type, same id, different window — a sibling iframe, a popup,
// or a frame the app itself embedded.
function replyFromImposter(data: unknown) {
  const event = new MessageEvent('message', { data })
  Object.defineProperty(event, 'source', { value: { notTheParent: true }, configurable: true })
  window.dispatchEvent(event)
}

// The id the hook used for its most recent request of this type.
function requestId(type: string): number {
  const call = [...parentPostMessage.mock.calls].reverse().find((c) => c[0]?.type === type)
  if (!call) throw new Error(`no ${type} request was posted`)
  return call[0].id
}

// Drain pending microtasks and one timer turn. Every negative assertion below
// needs this: a listener that wrongly accepted a forged reply resolves its
// promise in a microtask, so asserting synchronously after dispatch reports
// "not settled" whether the guard is present or not — the assertion passes for
// the wrong reason and the test cannot fail.
async function flush() {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0))
  })
}

beforeEach(() => {
  parentPostMessage = vi.fn()
  parentStub = { postMessage: parentPostMessage }
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

describe('usePush', () => {
  it('ignores a status reply that did not come from the shell', async () => {
    const { result } = renderHook(() => usePush(), { wrapper })
    await waitFor(() => expect(parentPostMessage).toHaveBeenCalled())
    const id = requestId('push-status')

    act(() => {
      replyFromImposter({ type: 'push-status-result', id, ok: true, subscribed: true, permission: 'granted' })
    })
    await flush()
    // Still the initial state: the forged reply claimed a subscription.
    expect(result.current.subscribed).toBe(false)

    // The genuine reply is accepted, which proves the assertion above failed
    // for the right reason rather than because nothing was listening.
    act(() => {
      replyFromParent({ type: 'push-status-result', id, ok: true, subscribed: true, permission: 'granted' })
    })
    await waitFor(() => expect(result.current.subscribed).toBe(true))
  })

  it('ignores a subscribe reply that did not come from the shell', async () => {
    const { result } = renderHook(() => usePush(), { wrapper })
    await waitFor(() => expect(parentPostMessage).toHaveBeenCalled())

    let settled = false
    act(() => {
      void result.current.subscribe().then(
        () => {
          settled = true
        },
        () => {
          settled = true
        }
      )
    })
    await waitFor(() => expect(parentPostMessage).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'push-subscribe' }),
      '*'
    ))
    const id = requestId('push-subscribe')

    act(() => {
      replyFromImposter({ type: 'push-result', id, ok: true })
    })
    await flush()
    expect(settled).toBe(false)

    act(() => {
      replyFromParent({ type: 'push-result', id, ok: true })
    })
    await waitFor(() => expect(settled).toBe(true))
  })

  it('ignores an unsubscribe reply that did not come from the shell', async () => {
    const { result } = renderHook(() => usePush(), { wrapper })
    await waitFor(() => expect(parentPostMessage).toHaveBeenCalled())

    let settled = false
    act(() => {
      void result.current.unsubscribe().then(
        () => {
          settled = true
        },
        () => {
          settled = true
        }
      )
    })
    await waitFor(() => expect(parentPostMessage).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'push-unsubscribe' }),
      '*'
    ))
    const id = requestId('push-unsubscribe')

    act(() => {
      replyFromImposter({ type: 'push-unsubscribe-result', id, ok: true })
    })
    await flush()
    expect(settled).toBe(false)

    act(() => {
      replyFromParent({ type: 'push-unsubscribe-result', id, ok: true })
    })
    await waitFor(() => expect(settled).toBe(true))
  })
})
