// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: AGPL-3.0-only
// This file is part of Mochi, licensed under the GNU AGPL v3 with the
// Mochi Application Interface Exception - see license.txt and license-exception.md.

import { describe, it, expect, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createElement, type ReactNode } from 'react'

const { post } = vi.hoisted(() => ({
  post: vi.fn(async () => ({ id: 'a1', type: 'email' })),
}))

vi.mock('../lib/request', () => ({
  requestHelpers: {
    get: vi.fn(async () => []),
    post: (...args: unknown[]) => post(...(args as [])),
  },
}))
vi.mock('../lib/permission-utils', () => ({ handlePermissionError: vi.fn() }))

import { useAccounts } from './use-accounts'

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return createElement(QueryClientProvider, { client }, children)
}

// The settings handler reads `existing`; the key the form carried before
// was silently ignored and every account was wired into every category.
describe('useAccounts.add', () => {
  it('sends the category choice under the key the handler reads', async () => {
    const { result } = renderHook(() => useAccounts('/settings'), { wrapper })
    await act(async () => {
      await result.current.add('email', { address: 'a@example.com' }, false)
    })
    const call = post.mock.calls.at(-1) as unknown as [string, string]
    expect(call[0]).toBe('/settings/-/accounts/add')
    expect(call[1]).toContain('existing=0')
    expect(call[1]).not.toContain('add_to_existing')
  })

  it('defaults to wiring the account into existing categories', async () => {
    const { result } = renderHook(() => useAccounts('/settings'), { wrapper })
    await act(async () => {
      await result.current.add('email', { address: 'a@example.com' })
    })
    const call = post.mock.calls.at(-1) as unknown as [string, string]
    expect(call[1]).toContain('existing=1')
  })
})
