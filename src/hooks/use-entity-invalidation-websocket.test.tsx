// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: Apache-2.0

// Both entity apps hand their live list refresh to this hook, and it shipped
// with nothing asserting it. The parts that matter are the ones that decide
// whether a socket opens at all: an uninitialised auth store and a missing
// fingerprint both mean "not yet", and getting either wrong subscribes with a
// key the server will reject, or never subscribes and leaves the page stale.

import { renderHook } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useEntityInvalidationWebsocket } from './use-entity-invalidation-websocket'
import {
  entityWebsocketManager,
  type EntityWebsocketEvent,
} from '../lib/entity-websocket-manager'
import { useAuthStore } from '../stores/auth-store'

const unsubscribe = vi.fn()

vi.mock('../lib/entity-websocket-manager', () => ({
  entityWebsocketManager: { subscribe: vi.fn(() => unsubscribe) },
}))

const subscribe = vi.mocked(entityWebsocketManager.subscribe)

/** The listener the hook handed the manager on its most recent subscribe. */
function lastListener(): (event: EntityWebsocketEvent) => void {
  return subscribe.mock.calls[subscribe.mock.calls.length - 1][1]
}

function setup(
  props: Parameters<typeof useEntityInvalidationWebsocket>[0],
  client = new QueryClient()
) {
  const invalidate = vi.spyOn(client, 'invalidateQueries')
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  )
  return {
    invalidate,
    ...renderHook(() => useEntityInvalidationWebsocket(props), { wrapper }),
  }
}

describe('useEntityInvalidationWebsocket', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useAuthStore.setState({ isInitialized: true, token: 'token-1' })
  })

  it('waits for the auth store before opening a socket', () => {
    useAuthStore.setState({ isInitialized: false })
    setup({
      fingerprint: 'abc',
      eventTypes: ['object.created'],
      queryKey: ['objects'],
    })
    expect(subscribe).not.toHaveBeenCalled()
  })

  it('stays quiet until there is an entity to subscribe to', () => {
    setup({
      fingerprint: undefined,
      eventTypes: ['object.created'],
      queryKey: ['objects'],
    })
    expect(subscribe).not.toHaveBeenCalled()
  })

  it('subscribes under the entity fingerprint', () => {
    setup({
      fingerprint: 'abc',
      eventTypes: ['object.created'],
      queryKey: ['objects'],
    })
    expect(subscribe).toHaveBeenCalledTimes(1)
    expect(subscribe.mock.calls[0][0]).toBe('abc')
  })

  it('invalidates the caller its key when a listed event arrives', () => {
    const { invalidate } = setup({
      fingerprint: 'abc',
      eventTypes: ['object.created', 'object.deleted'],
      queryKey: ['objects', 'abc'],
    })

    lastListener()({ type: 'object.deleted' })

    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['objects', 'abc'] })
  })

  it('leaves the cache alone for an event it was not asked about', () => {
    const { invalidate } = setup({
      fingerprint: 'abc',
      eventTypes: ['object.created'],
      queryKey: ['objects'],
    })

    lastListener()({ type: 'comment.created' })

    expect(invalidate).not.toHaveBeenCalled()
  })

  it('drops the subscription when the page goes away', () => {
    const { unmount } = setup({
      fingerprint: 'abc',
      eventTypes: ['object.created'],
      queryKey: ['objects'],
    })

    unmount()

    expect(unsubscribe).toHaveBeenCalledTimes(1)
  })

  // A new token is a new socket: the old one authenticated as whoever was
  // signed in before, so it has to be torn down rather than reused.
  it('reopens the socket when the token changes under it', () => {
    const client = new QueryClient()
    const { rerender } = setup(
      {
        fingerprint: 'abc',
        eventTypes: ['object.created'],
        queryKey: ['objects'],
      },
      client
    )
    expect(subscribe).toHaveBeenCalledTimes(1)

    useAuthStore.setState({ token: 'token-2' })
    rerender()

    expect(unsubscribe).toHaveBeenCalledTimes(1)
    expect(subscribe).toHaveBeenCalledTimes(2)
  })
})
