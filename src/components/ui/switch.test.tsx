// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: Apache-2.0

import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { Switch, SwitchLabel } from './switch'

describe('Switch loading state', () => {
  it('ignores clicks while its change is saved, without reading as unavailable', () => {
    const change = vi.fn()
    render(<Switch aria-label='Fediverse' loading onCheckedChange={change} />)

    const toggle = screen.getByRole('switch', { name: 'Fediverse' })
    fireEvent.click(toggle)
    expect(change).not.toHaveBeenCalled()
    expect(toggle).toHaveAttribute('aria-checked', 'false')
    expect(toggle).toHaveAttribute('aria-busy', 'true')
    // Not disabled, so it shows the busy pointer rather than not-allowed.
    expect(toggle).not.toBeDisabled()
    expect(toggle.className).toContain('data-[loading]:cursor-progress')
    expect(toggle).toHaveAttribute('data-loading')
  })

  it('toggles once the save ends', () => {
    const change = vi.fn()
    const { rerender } = render(
      <Switch aria-label='Fediverse' loading onCheckedChange={change} />
    )
    rerender(<Switch aria-label='Fediverse' onCheckedChange={change} />)

    const toggle = screen.getByRole('switch', { name: 'Fediverse' })
    expect(toggle).not.toHaveAttribute('aria-busy')
    fireEvent.click(toggle)
    expect(change).toHaveBeenCalledWith(true)
  })

  it('keeps a caller click handler, and the disabled state for a switch the user may not use', () => {
    const click = vi.fn()
    render(<Switch aria-label='Fediverse' disabled onClick={click} />)

    const toggle = screen.getByRole('switch', { name: 'Fediverse' })
    expect(toggle).toBeDisabled()
    expect(toggle).not.toHaveAttribute('aria-busy')

    render(<Switch aria-label='Bluesky' onClick={click} />)
    fireEvent.click(screen.getByRole('switch', { name: 'Bluesky' }))
    expect(click).toHaveBeenCalledTimes(1)
  })
})

describe('SwitchLabel', () => {
  it('toggles the switch from its words', () => {
    const onCheckedChange = vi.fn()
    render(
      <SwitchLabel label='Required'>
        <Switch checked={false} onCheckedChange={onCheckedChange} />
      </SwitchLabel>
    )
    fireEvent.click(screen.getByText('Required'))
    expect(onCheckedChange).toHaveBeenCalledWith(true)
  })

  it('puts the switch at the end of the row below sm only', () => {
    render(
      <SwitchLabel label='Required'>
        <Switch />
      </SwitchLabel>
    )
    const row = screen.getByText('Required').closest('label')!
    expect(row.className).toContain('max-sm:flex-row-reverse')
    expect(row.className).toContain('max-sm:justify-between')
    expect(row.className).not.toMatch(/(^| )flex-row-reverse/)
  })
})
