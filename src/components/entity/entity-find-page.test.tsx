// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: Apache-2.0

// EntityFindPage is an adapter: it hands FindEntityPage a set of already-held
// ids, a subscribe handler and a probe resolver, and renders nothing itself.
// The presentation is FindEntityPage's own concern, so it is stubbed and these
// blocks drive the four pieces of logic the adapter owns.
import type { ReactElement } from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, waitFor } from './entity-test-utils'
import { EntityFindPage } from './entity-find-page'
import { FileText } from 'lucide-react'

// Captured rather than rendered: every assertion below is about what the
// adapter passes down, which is the whole of what it does.
let passed: Record<string, never>

vi.mock('../search-entity-page', () => ({
  FindEntityPage: (props: Record<string, never>) => {
    passed = props
    return <div data-testid='find-entity-page' />
  },
}))

vi.mock('../../lib/toast-action', () => ({
  toastAction: (promise: Promise<unknown>) => promise,
}))

const labels = {
  title: 'title',
  placeholder: 'placeholder',
  emptyMessage: 'emptyMessage',
  subscribing: 'subscribing',
  subscribed: 'subscribed',
  subscribeFailed: 'subscribeFailed',
}

function renderPage(overrides: Record<string, unknown> = {}) {
  const api = {
    recommendations: vi.fn(async () => ({ data: { crms: [{ id: 'r1' }] } })),
    subscribe: vi.fn(async () => ({})),
    probe: vi.fn(async () => ({ data: { id: 'p1', server: 'node-a' } })),
  }
  const onOpen = vi.fn()
  const refresh = vi.fn()
  const props = {
    api,
    listKey: 'crms',
    queryKey: 'crms',
    rows: [{ id: 'c1', fingerprint: 'f1' }],
    refresh,
    entityClass: 'crm',
    searchEndpoint: '/-/directory/search',
    icon: FileText,
    labels,
    onOpen,
    ...overrides,
  }
  const Page = EntityFindPage as unknown as (
    p: Record<string, unknown>
  ) => ReactElement
  render(<Page {...props} />)
  return { api, onOpen, refresh }
}

describe('EntityFindPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('reads the recommendations out of the key this app answers under', async () => {
    renderPage()
    await waitFor(() => expect(passed.recommendations).toHaveLength(1))
  })

  it('treats an unknown list key as no recommendations rather than failing', async () => {
    renderPage({ listKey: 'projects' })
    await waitFor(() => expect(passed).toBeDefined())
    expect(passed.recommendations).toEqual([])
  })

  // A container is already held under either its id or its fingerprint, and the
  // sidebar rows carry both.
  it('counts a held container as subscribed under both its id and its fingerprint', () => {
    renderPage()
    const ids = passed.subscribedIds as unknown as Set<string>
    expect(ids.has('c1')).toBe(true)
    expect(ids.has('f1')).toBe(true)
    expect(ids.has('other')).toBe(false)
  })

  it('subscribes with the location and peer the entry carried', async () => {
    const { api } = renderPage()
    await (
      passed.onSubscribe as unknown as (
        id: string,
        e: Record<string, string>
      ) => Promise<void>
    )('e1', { location: 'node-a', peer: 'peer-1' })
    expect(api.subscribe).toHaveBeenCalledWith('e1', 'node-a', 'peer-1')
  })

  it('refreshes the sidebar before opening the new container', async () => {
    const { onOpen, refresh } = renderPage()
    await (
      passed.onSubscribe as unknown as (
        id: string,
        e: Record<string, string>
      ) => Promise<void>
    )('e1', { fingerprint: 'newfp' })
    expect(refresh).toHaveBeenCalled()
    expect(onOpen).toHaveBeenCalledWith('newfp')
  })

  // A probed remote with no fingerprint of its own answers with "", and an
  // empty id routes to the list root, so the fallback has to be `||`.
  it('opens on the id when the probed entry carried an empty fingerprint', async () => {
    const { onOpen } = renderPage()
    await (
      passed.onSubscribe as unknown as (
        id: string,
        e: Record<string, string>
      ) => Promise<void>
    )('e1', { fingerprint: '' })
    expect(onOpen).toHaveBeenCalledWith('e1')
  })

  it('does not open anything when the subscribe fails', async () => {
    const { onOpen } = renderPage({
      api: {
        recommendations: vi.fn(async () => ({ data: { crms: [] } })),
        subscribe: vi.fn(async () => {
          throw new Error('nope')
        }),
        probe: vi.fn(),
      },
    })
    await (
      passed.onSubscribe as unknown as (
        id: string,
        e: Record<string, string>
      ) => Promise<void>
    )('e1', {})
    expect(onOpen).not.toHaveBeenCalled()
  })

  it('resolves a share link to its container, naming the server as location', async () => {
    renderPage()
    const resolved = await (
      passed.resolveUri as unknown as (
        u: string
      ) => Promise<Record<string, string> | null>
    )('mochi://x')
    expect(resolved).toMatchObject({ id: 'p1', location: 'node-a' })
  })

  it('resolves to nothing when the probe answered without an id', async () => {
    renderPage({
      api: {
        recommendations: vi.fn(async () => ({ data: { crms: [] } })),
        subscribe: vi.fn(),
        probe: vi.fn(async () => ({ data: {} })),
      },
    })
    const resolved = await (
      passed.resolveUri as unknown as (u: string) => Promise<unknown>
    )('mochi://x')
    expect(resolved).toBeNull()
  })
})
