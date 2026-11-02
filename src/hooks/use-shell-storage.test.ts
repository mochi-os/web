// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: Apache-2.0

import { act, renderHook, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

const read = vi.hoisted(() => ({
  answer: null as ((value: string | null) => void) | null,
}))

vi.mock('../lib/shell-storage', () => ({
  getItem: () =>
    new Promise<string | null>((resolve) => {
      read.answer = resolve
    }),
  setItem: vi.fn(),
}))

const { useShellStorage } = await import('./use-shell-storage')

describe('useShellStorage', () => {
  it('says when the stored value has been read, so a caller need not act on the default', async () => {
    const { result } = renderHook(() => useShellStorage('key', ['default']))
    expect(result.current[0]).toEqual(['default'])
    expect(result.current[2]).toBe(false)
    act(() => read.answer?.(JSON.stringify(['stored'])))
    await waitFor(() => expect(result.current[2]).toBe(true))
    expect(result.current[0]).toEqual(['stored'])
  })

  it('counts nothing stored as read', async () => {
    const { result } = renderHook(() => useShellStorage('key', 1))
    act(() => read.answer?.(null))
    await waitFor(() => expect(result.current[2]).toBe(true))
    expect(result.current[0]).toBe(1)
  })

  it('says unread again for a new key until that key is read', async () => {
    const { result, rerender } = renderHook(
      ({ key }) => useShellStorage(key, 0),
      { initialProps: { key: 'first' } }
    )
    act(() => read.answer?.('1'))
    await waitFor(() => expect(result.current[2]).toBe(true))
    rerender({ key: 'second' })
    expect(result.current[2]).toBe(false)
  })
})
