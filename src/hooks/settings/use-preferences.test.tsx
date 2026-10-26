// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: Apache-2.0

// A preference picked in settings shows before the server answers, and the
// one before it comes back if the server refuses.
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createElement, type ReactNode } from 'react'
import { usePreferencesData, useSetPreference } from './use-preferences'

const { get, post } = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn() }))
vi.mock('../../lib/api-client', () => ({ apiClient: { get, post } }))

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return createElement(QueryClientProvider, { client }, children)
}

function renderPreferences() {
  return renderHook(
    () => ({
      data: usePreferencesData('-/preferences'),
      set: useSetPreference('-/preferences/set'),
    }),
    { wrapper }
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  get.mockResolvedValue({ data: { preferences: { language: 'en' } } })
})

describe('useSetPreference', () => {
  it('shows the pick at once and the old value back when refused', async () => {
    let refuse!: (error: unknown) => void
    post.mockReturnValue(
      new Promise((_resolve, reject) => {
        refuse = reject
      })
    )
    const { result } = renderPreferences()
    await waitFor(() =>
      expect(result.current.data.data?.preferences.language).toBe('en')
    )

    act(() => result.current.set.mutate({ language: 'fr' }))
    await waitFor(() =>
      expect(result.current.data.data?.preferences.language).toBe('fr')
    )

    act(() => refuse({ response: { status: 500 } }))
    await waitFor(() => expect(result.current.set.isError).toBe(true))
    expect(result.current.data.data?.preferences.language).toBe('en')
    expect(get).toHaveBeenCalledTimes(1)
  })

  it('reads the server again once it accepts, as before', async () => {
    post.mockResolvedValue({ data: {} })
    const { result } = renderPreferences()
    await waitFor(() => expect(get).toHaveBeenCalledTimes(1))

    get.mockResolvedValue({ data: { preferences: { language: 'fr' } } })
    act(() => result.current.set.mutate({ language: 'fr' }))
    await waitFor(() => expect(get).toHaveBeenCalledTimes(2))
    expect(result.current.data.data?.preferences.language).toBe('fr')
  })
})
