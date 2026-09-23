// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: Apache-2.0

import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { Slider } from './slider'

describe('Slider', () => {
  it('names the thumb, which is the element that carries role="slider"', () => {
    render(<Slider aria-label='Volume' value={[40]} />)
    const thumb = screen.getByRole('slider', { name: 'Volume' })
    expect(thumb).toHaveAttribute('aria-valuenow', '40')
    expect(thumb).toHaveAttribute('aria-valuemin', '0')
    expect(thumb).toHaveAttribute('aria-valuemax', '100')
  })

  it('takes its name from a visible label', () => {
    render(
      <>
        <span id='cred'>Credibility</span>
        <Slider aria-labelledby='cred' value={[50]} />
      </>
    )
    expect(
      screen.getByRole('slider', { name: 'Credibility' })
    ).toBeInTheDocument()
  })

  it('reports and commits a keyboard step', () => {
    const change = vi.fn()
    const commit = vi.fn()
    render(
      <Slider
        aria-label='Weight'
        min={-100}
        max={100}
        value={[0]}
        onValueChange={change}
        onValueCommit={commit}
      />
    )
    fireEvent.keyDown(screen.getByRole('slider'), { key: 'ArrowRight' })
    expect(change).toHaveBeenCalledWith([1])
    expect(commit).toHaveBeenCalledWith([1])
  })

  it('ignores input while disabled', () => {
    const change = vi.fn()
    render(
      <Slider
        aria-label='Volume'
        value={[40]}
        disabled
        onValueChange={change}
      />
    )
    const thumb = screen.getByRole('slider')
    fireEvent.keyDown(thumb, { key: 'ArrowRight' })
    expect(change).not.toHaveBeenCalled()
    expect(thumb).toHaveAttribute('data-disabled')
  })
})
