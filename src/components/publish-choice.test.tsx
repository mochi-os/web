// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: Apache-2.0

import { describe, it, expect, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { PublishChoice } from './publish-choice'

const accounts = [
  { id: 'b', identifier: 'zed.example' },
  { id: 'a', identifier: '@alice@example.com' },
  { id: 'c', identifier: 'carol.bsky.social' },
]

describe('PublishChoice', () => {
  it('shows one line naming the accounts chosen, and no switches until opened', () => {
    render(
      <PublishChoice
        label='Also post to'
        accounts={accounts}
        selected={['b', 'a']}
        onChange={() => {}}
      />
    )
    const line = screen.getByRole('button', { name: /Also post to/ })
    expect(line.getAttribute('aria-expanded')).toBe('false')
    expect(line.textContent).toContain('@alice@example.com and zed.example')
    expect(line.textContent).not.toContain('carol.bsky.social')
    expect(screen.queryAllByRole('switch')).toHaveLength(0)

    fireEvent.click(line)
    expect(line.getAttribute('aria-expanded')).toBe('true')
    const switches = screen.getAllByRole('switch')
    expect(switches.map((s) => s.getAttribute('aria-label'))).toEqual([
      '@alice@example.com',
      'carol.bsky.social',
      'zed.example',
    ])
    expect(switches.map((s) => s.getAttribute('aria-checked'))).toEqual([
      'true',
      'false',
      'true',
    ])

    fireEvent.click(line)
    expect(screen.queryAllByRole('switch')).toHaveLength(0)
  })

  it('switches an account on and off for this item alone', () => {
    const onChange = vi.fn()
    render(
      <PublishChoice
        label='Also post to'
        accounts={accounts}
        selected={['a']}
        onChange={onChange}
      />
    )
    fireEvent.click(screen.getByRole('button', { name: /Also post to/ }))
    fireEvent.click(screen.getByRole('switch', { name: 'carol.bsky.social' }))
    expect(onChange).toHaveBeenLastCalledWith(['a', 'c'])
    fireEvent.click(screen.getByRole('switch', { name: '@alice@example.com' }))
    expect(onChange).toHaveBeenLastCalledWith([])
  })

  it('shows nothing without an account to choose', () => {
    const { container } = render(
      <PublishChoice
        label='Also post to'
        accounts={[]}
        selected={[]}
        onChange={() => {}}
      />
    )
    expect(container.innerHTML).toBe('')
  })
})
