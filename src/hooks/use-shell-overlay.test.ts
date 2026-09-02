// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: Apache-2.0

// The shell forgets the overlay unless it is re-asserted, so the hook keeps
// posting while mounted and stops, with one final close, when its last user
// unmounts.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook } from '@testing-library/react'

vi.mock('../lib/shell-bridge', () => ({
  isInShell: () => true,
  shellOrigin: () => '*',
}))

import { useShellOverlay } from './use-shell-overlay'

type Message = { type: string; open: boolean }

let posted: Message[]

beforeEach(() => {
  vi.useFakeTimers()
  posted = []
  vi.spyOn(window.parent, 'postMessage').mockImplementation(((message: unknown) => {
    posted.push(message as Message)
  }) as typeof window.parent.postMessage)
})

afterEach(() => {
  vi.restoreAllMocks()
  vi.useRealTimers()
})

describe('useShellOverlay', () => {
  it('re-asserts the overlay while mounted and closes it once on unmount', () => {
    const { unmount } = renderHook(() => useShellOverlay(true))
    expect(posted).toEqual([{ type: 'overlay', open: true }])
    vi.advanceTimersByTime(11000)
    expect(posted.filter(m => m.open)).toHaveLength(3)
    unmount()
    expect(posted.at(-1)).toEqual({ type: 'overlay', open: false })
    vi.advanceTimersByTime(20000)
    expect(posted.filter(m => m.open)).toHaveLength(3)
  })

  it('keeps one heartbeat for several users and closes only after the last', () => {
    const first = renderHook(() => useShellOverlay(true))
    const second = renderHook(() => useShellOverlay(true))
    vi.advanceTimersByTime(5000)
    expect(posted.filter(m => m.open)).toHaveLength(2)
    first.unmount()
    expect(posted.some(m => !m.open)).toBe(false)
    second.unmount()
    expect(posted.at(-1)).toEqual({ type: 'overlay', open: false })
  })
})
