// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: Apache-2.0

import { render, screen } from '@testing-library/react'
import { ArrowRight, Save } from 'lucide-react'
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

describe('Button trailing icon', () => {
  it('renders a trailing icon after the label at rest', () => {
    render(
      <Button trailingIcon={<ArrowRight data-testid='trailing-icon' />}>
        Continue
      </Button>
    )

    const button = screen.getByRole('button', { name: 'Continue' })
    const icon = screen.getByTestId('trailing-icon')
    const nodes = Array.from(button.childNodes)

    expect(nodes[nodes.length - 1]).toBe(icon)
  })

  it('replaces the trailing icon with the spinner in the same trailing position while loading', () => {
    render(
      <Button
        loading
        trailingIcon={<ArrowRight data-testid='trailing-icon' />}
      >
        Continue
      </Button>
    )

    const button = screen.getByRole('button', { name: 'Continue' })
    expect(button).toBeDisabled()
    expect(screen.queryByTestId('trailing-icon')).not.toBeInTheDocument()

    const spinner = button.querySelector('[data-slot="button-spinner"]')
    expect(spinner).not.toBeNull()

    const nodes = Array.from(button.childNodes)
    expect(nodes[nodes.length - 1]).toBe(spinner)
  })
})

describe('Button spinner geometry', () => {
  it('gives the spinner the leading icon classes so the label does not move', () => {
    render(
      <Button loading icon={<Save className='me-2 size-3' />}>
        Save
      </Button>
    )

    const spinner = screen
      .getByRole('button', { name: 'Save' })
      .querySelector('[data-slot="button-spinner"]')
    expect(spinner).toHaveClass('me-2', 'size-3', 'animate-spin')
  })

  it('gives the spinner the trailing icon classes', () => {
    render(
      <Button loading trailingIcon={<ArrowRight className='ms-2 h-4 w-4' />}>
        Continue
      </Button>
    )

    const spinner = screen
      .getByRole('button', { name: 'Continue' })
      .querySelector('[data-slot="button-spinner"]')
    expect(spinner).toHaveClass('ms-2', 'h-4', 'w-4', 'animate-spin')
  })
})
