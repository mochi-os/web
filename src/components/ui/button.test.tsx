// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: Apache-2.0

import { render, screen } from '@testing-library/react'
import { Save } from 'lucide-react'
import { describe, expect, it } from 'vitest'
import { Button } from './button'

describe('Button loading state', () => {
  it('replaces the resting icon and keeps the label', () => {
    render(
      <Button loading icon={<Save data-testid='resting-icon' />}>
        Save
      </Button>
    )

    const button = screen.getByRole('button', { name: 'Save' })
    expect(button).toBeDisabled()
    expect(button).toHaveAttribute('aria-busy', 'true')
    expect(screen.queryByTestId('resting-icon')).not.toBeInTheDocument()
    expect(button.querySelector('[data-slot="button-spinner"]')).not.toBeNull()
  })

  it('adds a spinner before a label when no resting icon exists', () => {
    render(<Button loading>Subscribe</Button>)

    const button = screen.getByRole('button', { name: 'Subscribe' })
    expect(button.querySelector('[data-slot="button-spinner"]')).not.toBeNull()
  })

  it('keeps an icon-only button accessible while loading', () => {
    render(<Button loading icon={<Save />} size='icon' aria-label='Save' />)

    expect(screen.getByRole('button', { name: 'Save' })).toHaveAttribute(
      'aria-busy',
      'true'
    )
  })
})
