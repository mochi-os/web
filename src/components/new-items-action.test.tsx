// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: Apache-2.0

// The header action that stands in for the old new-items pill: nothing at
// zero, the number as its visible label, the words for the screen reader.

import { describe, it, expect, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { NewItemsAction } from './new-items-action'

describe('NewItemsAction', () => {
  it('renders nothing while no items are waiting', () => {
    const { container } = render(
      <NewItemsAction count={0} onClick={() => {}} label='0 new posts' />
    )
    expect(container).toBeEmptyDOMElement()
  })

  it('writes the number and gives the words to the screen reader', () => {
    render(<NewItemsAction count={3} onClick={() => {}} label='3 new posts' />)
    const button = screen.getByRole('button', { name: '3 new posts' })
    expect(button).toHaveTextContent('3')
    expect(button).not.toHaveTextContent('new')
  })

  it('merges the waiting items on click', () => {
    const onClick = vi.fn()
    render(<NewItemsAction count={3} onClick={onClick} label='3 new posts' />)
    fireEvent.click(screen.getByRole('button'))
    expect(onClick).toHaveBeenCalledTimes(1)
  })
})
