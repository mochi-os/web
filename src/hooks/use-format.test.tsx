// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: Apache-2.0

import { describe, it, expect } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useFormat } from './use-format'

describe('useFormat', () => {
  it('joins a list the way the interface language does', () => {
    const { result } = renderHook(() => useFormat())
    expect(result.current.formatList(['Epic', 'Story', 'Task'], 'disjunction')).toBe('Epic, Story, or Task')
    expect(result.current.formatList(['Epic', 'Story'])).toBe('Epic and Story')
    expect(result.current.formatList(['Epic'])).toBe('Epic')
  })

  it('hands back the same formatters while nothing changed', () => {
    const { result, rerender } = renderHook(() => useFormat())
    const first = result.current
    rerender()
    expect(result.current).toBe(first)
  })
})
