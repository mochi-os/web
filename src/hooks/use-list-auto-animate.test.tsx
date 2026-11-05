// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: Apache-2.0

import { describe, expect, it, vi } from 'vitest'
import { render } from '@testing-library/react'

// What auto-animate's own hook is handed: an element attaches it, null
// detaches it.
const attached = vi.fn()
vi.mock('@formkit/auto-animate/react', () => ({
  useAutoAnimate: () => [attached, vi.fn()],
}))

const { useListAutoAnimate } = await import('./use-list-auto-animate')

function List({ count }: { count: number }) {
  const [ref] = useListAutoAnimate<HTMLDivElement>({ count })
  return <div ref={ref} data-testid='list' />
}

const elements = () =>
  attached.mock.calls.filter(([node]) => node instanceof HTMLElement).length

describe('useListAutoAnimate', () => {
  it('attaches auto-animate to a short list', () => {
    attached.mockClear()
    render(<List count={5} />)
    expect(elements()).toBe(1)
  })

  it('never attaches it to a long list, which it would watch item by item for as long as it is shown', () => {
    attached.mockClear()
    render(<List count={1000} />)
    expect(elements()).toBe(0)
  })

  it('detaches it from a list that grows long, and attaches it again when it is short', () => {
    attached.mockClear()
    const { rerender } = render(<List count={5} />)
    rerender(<List count={500} />)
    expect(attached.mock.calls.at(-1)?.[0]).toBeNull()
    rerender(<List count={5} />)
    expect(attached.mock.calls.at(-1)?.[0]).toBeInstanceOf(HTMLElement)
  })
})
