// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: Apache-2.0

import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { Switch, SwitchLabel } from './switch'

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
