// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: Apache-2.0

import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { Progress } from './progress'

function bar() {
  return screen.getByRole('progressbar', { name: 'Upload progress' })
}

function fill() {
  return bar().querySelector('[data-slot=progress-indicator]') as HTMLElement
}

describe('Progress', () => {
  it('exposes a labelled determinate value', () => {
    render(<Progress aria-label='Upload progress' value={40} />)

    expect(bar()).toHaveAttribute('aria-valuenow', '40')
    expect(bar()).toHaveAttribute('aria-valuemin', '0')
    expect(bar()).toHaveAttribute('aria-valuemax', '100')
  })

  it('does not claim a value while work is indeterminate', () => {
    render(<Progress aria-label='Upload progress' value={null} />)

    expect(bar()).not.toHaveAttribute('aria-valuenow')
    expect(bar()).toHaveAttribute('data-state', 'indeterminate')
  })

  it('treats a missing value as indeterminate', () => {
    render(<Progress aria-label='Upload progress' />)

    expect(bar()).toHaveAttribute('data-state', 'indeterminate')
  })

  it('moves the fill by the share that is left', () => {
    render(<Progress aria-label='Upload progress' value={40} />)

    expect(fill().style.transform).toBe('translateX(-60%)')
  })

  it('mirrors the bar in a right-to-left page, so it grows from the right', () => {
    render(<Progress aria-label='Upload progress' value={40} />)

    expect(bar()).toHaveClass('rtl:-scale-x-100')
  })

  it('draws an unknown amount as a full, pulsing fill', () => {
    render(<Progress aria-label='Upload progress' value={null} />)

    expect(fill().style.transform).toBe('translateX(-0%)')
    expect(fill()).toHaveClass('animate-pulse')
  })

  it('reports loading and complete', () => {
    const { rerender } = render(
      <Progress aria-label='Upload progress' value={99} />
    )
    expect(bar()).toHaveAttribute('data-state', 'loading')

    rerender(<Progress aria-label='Upload progress' value={100} />)
    expect(bar()).toHaveAttribute('data-state', 'complete')
  })

  it('scales to max', () => {
    render(<Progress aria-label='Upload progress' value={3} max={4} />)

    expect(bar()).toHaveAttribute('aria-valuenow', '3')
    expect(bar()).toHaveAttribute('aria-valuemax', '4')
    expect(fill().style.transform).toBe('translateX(-25%)')
  })

  it('clamps a value outside the range', () => {
    const { rerender } = render(
      <Progress aria-label='Upload progress' value={140} />
    )
    expect(bar()).toHaveAttribute('aria-valuenow', '100')
    expect(fill().style.transform).toBe('translateX(-0%)')

    rerender(<Progress aria-label='Upload progress' value={-5} />)
    expect(bar()).toHaveAttribute('aria-valuenow', '0')
    expect(fill().style.transform).toBe('translateX(-100%)')
  })

  it('treats NaN as unknown without a console error', () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    render(<Progress aria-label='Upload progress' value={NaN} />)

    expect(bar()).not.toHaveAttribute('aria-valuenow')
    expect(bar()).toHaveAttribute('data-state', 'indeterminate')
    expect(error).not.toHaveBeenCalled()
    error.mockRestore()
  })

  it('lets a caller recolour and retime the fill', () => {
    render(
      <Progress
        aria-label='Upload progress'
        value={40}
        indicatorClassName='bg-destructive duration-200'
      />
    )

    expect(fill()).toHaveClass('bg-destructive', 'duration-200')
    expect(fill()).not.toHaveClass('bg-primary', 'duration-300')
  })

  it('lets a caller resize the track', () => {
    render(<Progress aria-label='Upload progress' value={40} className='h-2' />)

    expect(bar()).toHaveClass('h-2')
    expect(bar()).not.toHaveClass('h-1.5')
  })
})
