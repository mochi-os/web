// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: Apache-2.0

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { LazyBoundary } from './lazy-boundary'

// React reports a caught error to console.error on its own, on top of the
// boundary's own report. Silenced per test so a passing run stays readable, and
// restored so nothing else inherits the spy.
let reported: ReturnType<typeof vi.spyOn>
beforeEach(() => {
  reported = vi.spyOn(console, 'error').mockImplementation(() => {})
})
afterEach(() => {
  reported.mockRestore()
})

function Boom(): never {
  throw new Error('chunk gone')
}

describe('LazyBoundary', () => {
  it('renders its children while they hold', () => {
    render(
      <LazyBoundary fallback={<p>no picture</p>}>
        <p>the picture</p>
      </LazyBoundary>
    )
    expect(screen.getByText('the picture')).toBeInTheDocument()
    expect(screen.queryByText('no picture')).not.toBeInTheDocument()
  })

  it('renders the fallback in their place when one throws', () => {
    render(
      <LazyBoundary fallback={<p>no picture</p>}>
        <Boom />
      </LazyBoundary>
    )
    expect(screen.getByText('no picture')).toBeInTheDocument()
  })

  // The subtree is an enhancement at one of the call sites, so vanishing
  // quietly is the wanted behaviour there, not a missing case.
  it('renders nothing when no fallback is given', () => {
    const { container } = render(
      <LazyBoundary>
        <Boom />
      </LazyBoundary>
    )
    expect(container).toBeEmptyDOMElement()
  })

  // The owner usually has to change course as well as show something: a game
  // canvas that cannot load has to hand the player back to the menu.
  it('tells the owner once that the subtree failed', () => {
    const onFailure = vi.fn()
    render(
      <LazyBoundary onFailure={onFailure}>
        <Boom />
      </LazyBoundary>
    )
    expect(onFailure).toHaveBeenCalledTimes(1)
    expect(onFailure.mock.calls[0][0]).toBeInstanceOf(Error)
  })

  // Catching is what stops React reporting it, and a subtree that disappears
  // with no trace anywhere is a bug report nobody can act on.
  it('reports the error rather than swallowing it', () => {
    render(
      <LazyBoundary>
        <Boom />
      </LazyBoundary>
    )
    expect(reported.mock.calls.some((call: unknown[]) => String(call[0]).includes('subtree failed'))).toBe(true)
  })

  // One failure must not latch for the rest of the session: the boundary holds
  // no module-level state, so a later mount starts clean.
  it('starts clean on a later mount', () => {
    const first = render(
      <LazyBoundary fallback={<p>no picture</p>}>
        <Boom />
      </LazyBoundary>
    )
    expect(screen.getByText('no picture')).toBeInTheDocument()
    first.unmount()

    render(
      <LazyBoundary fallback={<p>no picture</p>}>
        <p>the picture</p>
      </LazyBoundary>
    )
    expect(screen.getByText('the picture')).toBeInTheDocument()
  })
})
