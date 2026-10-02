// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: Apache-2.0

// A page with unsaved edits is asked before anything takes it away: its own
// links through the router's blocker, the shell's back, forward and cross-app
// links through the shell, which hears whether the page holds edits.

import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

type Place = { pathname: string }
type Block = (arguments_: { current: Place; next: Place }) => boolean

const state = vi.hoisted(() => ({
  block: null as Block | null,
  beforeunload: null as (() => boolean) | null,
  status: 'idle' as 'idle' | 'blocked',
  proceed: vi.fn(),
  reset: vi.fn(),
  listener: null as ((message: { type: string }) => void) | null,
  unsaved: vi.fn(),
  answer: vi.fn(),
}))

vi.mock('@tanstack/react-router', () => ({
  useBlocker: (options: {
    shouldBlockFn: Block
    enableBeforeUnload: () => boolean
  }) => {
    state.block = options.shouldBlockFn
    state.beforeunload = options.enableBeforeUnload
    return { status: state.status, proceed: state.proceed, reset: state.reset }
  },
}))

vi.mock('../lib/shell-bridge', () => ({
  isInShell: () => true,
  onShellMessage: (listener: (message: { type: string }) => void) => {
    state.listener = listener
    return () => {
      state.listener = null
    }
  },
  shellSetUnsaved: state.unsaved,
  shellAnswerLeave: state.answer,
}))

import { useLeaveGuard } from './use-leave-guard'

const here = { pathname: '/system/documents' }
const away = { pathname: '/system/users' }

beforeEach(() => {
  state.status = 'idle'
  state.listener = null
  for (const spy of [state.proceed, state.reset, state.unsaved, state.answer])
    spy.mockReset()
})

describe('useLeaveGuard', () => {
  it('holds a router link away only while edits are unsaved', () => {
    const { rerender } = renderHook(({ dirty }) => useLeaveGuard(dirty), {
      initialProps: { dirty: false },
    })
    expect(state.block!({ current: here, next: away })).toBe(false)
    rerender({ dirty: true })
    expect(state.block!({ current: here, next: away })).toBe(true)
    // Within the page, by default, is not away.
    expect(state.block!({ current: here, next: here })).toBe(false)
    expect(state.beforeunload!()).toBe(true)
  })

  it('tells the shell whether the page holds edits, and nothing once it goes', () => {
    const { rerender, unmount } = renderHook(
      ({ dirty }) => useLeaveGuard(dirty),
      { initialProps: { dirty: false } }
    )
    rerender({ dirty: true })
    expect(state.unsaved).toHaveBeenLastCalledWith(true)
    unmount()
    expect(state.unsaved).toHaveBeenLastCalledWith(false)
  })

  it("asks when the shell asks, and answers with the user's choice", () => {
    const { result } = renderHook(() => useLeaveGuard(true))
    expect(result.current.asking).toBe(false)
    act(() => state.listener!({ type: 'leave-request' }))
    expect(result.current.asking).toBe(true)
    act(() => result.current.stay())
    expect(state.answer).toHaveBeenLastCalledWith(false)
    expect(result.current.asking).toBe(false)

    act(() => state.listener!({ type: 'leave-request' }))
    act(() => result.current.proceed())
    expect(state.answer).toHaveBeenLastCalledWith(true)
    expect(state.proceed).not.toHaveBeenCalled()
  })

  it('lets the page leave after it saves, without asking', () => {
    const { result } = renderHook(() => useLeaveGuard(true))
    expect(state.block!({ current: here, next: away })).toBe(true)
    act(() => result.current.release())
    expect(state.block!({ current: here, next: away })).toBe(false)
    expect(state.beforeunload!()).toBe(false)
    expect(state.unsaved).toHaveBeenLastCalledWith(false)
  })

  it("resolves the router's own hold through the blocker", () => {
    state.status = 'blocked'
    const { result } = renderHook(() => useLeaveGuard(true))
    expect(result.current.asking).toBe(true)
    act(() => result.current.stay())
    expect(state.reset).toHaveBeenCalled()
    act(() => result.current.proceed())
    expect(state.proceed).toHaveBeenCalled()
    expect(state.answer).not.toHaveBeenCalled()
  })
})
