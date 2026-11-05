// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: Apache-2.0

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { renderHook } from '@testing-library/react'
import { usePoll } from './use-poll'

// The milliseconds after mounting at which each call falls: 3 seconds, then
// each wait twice the last up to a minute, ending before ten minutes.
const calls = [
  3000, 9000, 21000, 45000, 93000, 153000, 213000, 273000, 333000, 393000,
  453000, 513000, 573000,
]

describe('usePoll', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('waits twice as long before each call, a minute at most', () => {
    const poll = vi.fn()
    renderHook(() => usePoll(true, poll))
    let now = 0
    for (const [index, at] of calls.entries()) {
      vi.advanceTimersByTime(at - now - 1)
      expect(poll).toHaveBeenCalledTimes(index)
      vi.advanceTimersByTime(1)
      expect(poll).toHaveBeenCalledTimes(index + 1)
      now = at
    }
  })

  it('stops after ten minutes', () => {
    const poll = vi.fn()
    renderHook(() => usePoll(true, poll))
    vi.advanceTimersByTime(600000)
    expect(poll).toHaveBeenCalledTimes(calls.length)
    vi.advanceTimersByTime(3600000)
    expect(poll).toHaveBeenCalledTimes(calls.length)
    expect(vi.getTimerCount()).toBe(0)
  })

  it('does not call while inactive', () => {
    const poll = vi.fn()
    renderHook(() => usePoll(false, poll))
    vi.advanceTimersByTime(600000)
    expect(poll).not.toHaveBeenCalled()
  })

  it('stops when the condition clears and starts over from 3 seconds when it holds again', () => {
    const poll = vi.fn()
    const { rerender } = renderHook(({ active }) => usePoll(active, poll), {
      initialProps: { active: true },
    })
    vi.advanceTimersByTime(45000)
    expect(poll).toHaveBeenCalledTimes(4)
    rerender({ active: false })
    vi.advanceTimersByTime(600000)
    expect(poll).toHaveBeenCalledTimes(4)
    rerender({ active: true })
    vi.advanceTimersByTime(2999)
    expect(poll).toHaveBeenCalledTimes(4)
    vi.advanceTimersByTime(1)
    expect(poll).toHaveBeenCalledTimes(5)
    vi.advanceTimersByTime(6000)
    expect(poll).toHaveBeenCalledTimes(6)
  })

  it('starts over from 3 seconds once the limit was reached and the condition holds again', () => {
    const poll = vi.fn()
    const { rerender } = renderHook(({ active }) => usePoll(active, poll), {
      initialProps: { active: true },
    })
    vi.advanceTimersByTime(600000)
    expect(poll).toHaveBeenCalledTimes(calls.length)
    rerender({ active: false })
    rerender({ active: true })
    vi.advanceTimersByTime(3000)
    expect(poll).toHaveBeenCalledTimes(calls.length + 1)
  })

  it('starts over from 3 seconds for another key', () => {
    const poll = vi.fn()
    const { rerender } = renderHook(({ key }) => usePoll(true, poll, key), {
      initialProps: { key: 'first' },
    })
    vi.advanceTimersByTime(45000)
    expect(poll).toHaveBeenCalledTimes(4)
    rerender({ key: 'second' })
    vi.advanceTimersByTime(3000)
    expect(poll).toHaveBeenCalledTimes(5)
  })

  it('keeps its pace when only the callback changes, and calls the newest one', () => {
    const first = vi.fn()
    const second = vi.fn()
    const { rerender } = renderHook(({ poll }) => usePoll(true, poll), {
      initialProps: { poll: first },
    })
    vi.advanceTimersByTime(9000)
    expect(first).toHaveBeenCalledTimes(2)
    rerender({ poll: second })
    vi.advanceTimersByTime(11999)
    expect(second).not.toHaveBeenCalled()
    vi.advanceTimersByTime(1)
    expect(second).toHaveBeenCalledTimes(1)
    expect(first).toHaveBeenCalledTimes(2)
  })

  it('stops when unmounted', () => {
    const poll = vi.fn()
    const { unmount } = renderHook(() => usePoll(true, poll))
    unmount()
    vi.advanceTimersByTime(600000)
    expect(poll).not.toHaveBeenCalled()
  })

  it('stops when a poll unmounts it', () => {
    let unmount = () => {}
    const poll = vi.fn(() => unmount())
    const rendered = renderHook(() => usePoll(true, poll))
    unmount = rendered.unmount
    vi.advanceTimersByTime(3000)
    expect(poll).toHaveBeenCalledTimes(1)
    expect(vi.getTimerCount()).toBe(0)
    vi.advanceTimersByTime(600000)
    expect(poll).toHaveBeenCalledTimes(1)
  })

  it('stops when a poll clears the condition', () => {
    let clear = () => {}
    const poll = vi.fn(() => clear())
    const rendered = renderHook(({ active }) => usePoll(active, poll), {
      initialProps: { active: true },
    })
    clear = () => rendered.rerender({ active: false })
    vi.advanceTimersByTime(3000)
    expect(poll).toHaveBeenCalledTimes(1)
    expect(vi.getTimerCount()).toBe(0)
    vi.advanceTimersByTime(600000)
    expect(poll).toHaveBeenCalledTimes(1)
  })
})
