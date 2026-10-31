// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: Apache-2.0

import type { ReactNode } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { EntityWebsocketEvent } from '../lib/entity-websocket-manager'

const socket = vi.hoisted(() => ({
  handler: null as ((event: EntityWebsocketEvent) => void) | null,
}))

vi.mock('../lib/entity-websocket-manager', () => ({
  entityWebsocketManager: {
    subscribe: (
      _key: string,
      handler: (event: EntityWebsocketEvent) => void
    ) => {
      socket.handler = handler
      return () => {}
    },
  },
}))

const { useEntityWebsocket } = await import('./use-entity-websocket')
const { useAuthStore } = await import('../stores/auth-store')

const objects = ['objects', 'fp']
const people = ['people', 'fp']

function setup(age: number) {
  const client = new QueryClient()
  const updatedAt = Date.now() - age
  client.setQueryData(objects, { objects: [] }, { updatedAt })
  client.setQueryData(people, [], { updatedAt })
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  )
  renderHook(
    () => useEntityWebsocket({ entity: 'project', fingerprint: 'fp' }),
    {
      wrapper,
    }
  )
  const stale = (key: string[]) =>
    client.getQueryState(key)?.isInvalidated ?? false
  return { stale }
}

describe('useEntityWebsocket held lists', () => {
  beforeEach(() => {
    useAuthStore.setState({ isInitialized: true, token: 't' } as never)
    socket.handler = null
  })

  // The lists are held for a while, and what changed while this page was not
  // listening reached no handler.
  it('asks again for lists held from before the page subscribed', () => {
    const { stale } = setup(60_000)
    expect(stale(objects)).toBe(true)
    expect(stale(people)).toBe(true)
  })

  it('takes lists this navigation has just fetched as current', () => {
    const { stale } = setup(500)
    expect(stale(objects)).toBe(false)
    expect(stale(people)).toBe(false)
  })

  it('asks again after a reconnect', () => {
    const { stale } = setup(500)
    socket.handler?.({ type: 'socket/reopen' })
    expect(stale(objects)).toBe(true)
    expect(stale(people)).toBe(true)
  })
})
