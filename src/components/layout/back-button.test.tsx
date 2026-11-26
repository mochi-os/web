// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: Apache-2.0

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

const state = vi.hoisted(() => ({
  canGoBack: true,
  shell: true,
  back: vi.fn(),
  shellBack: vi.fn((_otherwise?: () => void) => {}),
}))

vi.mock('@tanstack/react-router', () => ({
  useRouter: () => ({
    history: { canGoBack: () => state.canGoBack, back: state.back },
  }),
}))
vi.mock('../../lib/shell-bridge', () => ({
  isInShell: () => state.shell,
  shellNavigateBack: (otherwise?: () => void) => state.shellBack(otherwise),
}))

import { BackButton } from './back-button'

// The header's back: real history first, the page's destination otherwise.
describe('BackButton', () => {
  beforeEach(() => {
    state.canGoBack = true
    state.shell = true
    state.back = vi.fn()
    state.shellBack = vi.fn()
  })

  it("takes the page's destination where the shell has nowhere to go back to", async () => {
    const onFallback = vi.fn()
    render(<BackButton label='Back' onFallback={onFallback} />)
    fireEvent.click(screen.getByRole('button', { name: 'Back' }))
    expect(state.shellBack).toHaveBeenCalledTimes(1)
    expect(onFallback).not.toHaveBeenCalled()
    // THE POINT: the shell's refusal runs the destination, not nothing.
    state.shellBack.mock.calls[0][0]?.()
    await waitFor(() => expect(onFallback).toHaveBeenCalledTimes(1))
  })

  it('goes straight to the destination with no history of its own', async () => {
    state.canGoBack = false
    const onFallback = vi.fn()
    render(<BackButton label='Back' onFallback={onFallback} />)
    fireEvent.click(screen.getByRole('button', { name: 'Back' }))
    await waitFor(() => expect(onFallback).toHaveBeenCalledTimes(1))
    expect(state.shellBack).not.toHaveBeenCalled()
  })
})
