// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: Apache-2.0

import { describe, expect, it } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { useProgressive } from './use-progressive'

describe('useProgressive', () => {
  it('draws a short list whole at once', () => {
    const { result } = renderHook(() => useProgressive(40))
    expect(result.current).toBe(40)
  })

  it('draws the first hundred rows of a long list at once and the rest later', async () => {
    const { result } = renderHook(() => useProgressive(1000))
    expect(result.current).toBe(100)
    await waitFor(() => expect(result.current).toBe(1000))
  })

  it('draws the first hundred at once of a list that arrives after mounting', async () => {
    const { result, rerender } = renderHook(({ total }) => useProgressive(total), {
      initialProps: { total: 0 },
    })
    expect(result.current).toBe(0)
    rerender({ total: 1000 })
    expect(result.current).toBe(100)
    await waitFor(() => expect(result.current).toBe(1000))
  })

  it('draws a list progressively again once it has shrunk, as a search does', async () => {
    const { result, rerender } = renderHook(({ total }) => useProgressive(total), {
      initialProps: { total: 1000 },
    })
    await waitFor(() => expect(result.current).toBe(1000))
    rerender({ total: 20 })
    await waitFor(() => expect(result.current).toBe(20))
    rerender({ total: 1000 })
    expect(result.current).toBe(100)
    await waitFor(() => expect(result.current).toBe(1000))
  })
})
