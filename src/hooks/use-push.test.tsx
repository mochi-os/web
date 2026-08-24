// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: Apache-2.0

// Who answered. A push reply is matched on a fixed type and a counter id, so
// the only thing separating the shell's reply from a forged one is
// event.source and event.origin, both pinned by fromShell.

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

// A reply carrying the shell's identity, as the real parent's would: both the
// source window and the origin, which fromShell pins.
function replyFromParent(data: unknown, origin: string = window.location.origin) {
  const event = new MessageEvent('message', { data, origin })
  Object.defineProperty(event, 'source', { value: parentStub, configurable: true })
  window.dispatchEvent(event)
}

// The forgery: same type, same id, different window — a sibling iframe, a popup,
// or a frame the app itself embedded.
function replyFromImposter(data: unknown) {
  const event = new MessageEvent('message', { data, origin: window.location.origin })
  Object.defineProperty(event, 'source', { value: { notTheParent: true }, configurable: true })
  window.dispatchEvent(event)
}

// The id the hook used for its most recent request of this type.
function requestId(type: string): number {
  const call = [...parentPostMessage.mock.calls].reverse().find((c) => c[0]?.type === type)
  if (!call) throw new Error(`no ${type} request was posted`)
  return call[0].id
}

// Every negative assertion needs this: a wrongly accepted reply settles in a
// microtask, so a synchronous check reports "not settled" either way.
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
      window.location.origin
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
      window.location.origin
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
