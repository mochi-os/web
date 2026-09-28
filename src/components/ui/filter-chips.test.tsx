// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: Apache-2.0

import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { FilterChip, FilterChips } from './filter-chips'

function Chips({
  value = 'all',
  onValueChange = () => {},
  unread,
}: {
  value?: string
  onValueChange?: (value: string) => void
  unread?: number
}) {
  return (
    <FilterChips
      aria-label='Filter'
      value={value}
      onValueChange={onValueChange}
    >
      <FilterChip value='all'>All</FilterChip>
      <FilterChip value='unread' count={unread}>
        Unread
      </FilterChip>
      <FilterChip value='groups'>Groups</FilterChip>
    </FilterChips>
  )
}

describe('FilterChips', () => {
  it('is a named radio group with one chip checked', () => {
    render(<Chips value='groups' />)
    expect(screen.getByRole('radiogroup', { name: 'Filter' })).toBeVisible()
    expect(screen.getByRole('radio', { name: 'Groups' })).toBeChecked()
    expect(screen.getByRole('radio', { name: 'All' })).not.toBeChecked()
  })

  it('reports the chip that was clicked', () => {
    const change = vi.fn()
    render(<Chips onValueChange={change} />)
    fireEvent.click(screen.getByRole('radio', { name: 'Groups' }))
    expect(change).toHaveBeenCalledWith('groups')
  })

  it('shows a count in the chip name, and none for zero', () => {
    const { rerender } = render(<Chips unread={3} />)
    expect(screen.getByRole('radio', { name: 'Unread 3' })).toBeVisible()
    rerender(<Chips unread={0} />)
    expect(screen.getByRole('radio', { name: 'Unread' })).toBeVisible()
  })
})
