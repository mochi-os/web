// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: Apache-2.0

import { describe, it, expect, vi, beforeAll } from 'vitest'

beforeAll(() => {
  Element.prototype.hasPointerCapture = () => false
  Element.prototype.releasePointerCapture = () => {}
  Element.prototype.scrollIntoView = () => {}
})
import { render, screen, fireEvent, createMockEntityClass, createMockEntityView } from './entity-test-utils'
import { ViewSheet } from './entity-view-sheet'

function openSort() {
  // The sort select is the one whose current value reads None.
  const trigger = screen.getAllByRole('combobox').find((el) => el.textContent?.includes('None')) as HTMLElement
  fireEvent.pointerDown(trigger, new MouseEvent('pointerdown', { bubbles: true, button: 0, ctrlKey: false }))
  fireEvent.click(trigger)
}

describe('ViewSheet', () => {
  it('offers the Number sort only where objects are numbered', () => {
    const { unmount } = render(
      <ViewSheet open onOpenChange={() => {}} mode='create' fields={[]} classes={[createMockEntityClass()]} onCreate={vi.fn()} />
    )
    openSort()
    expect(screen.queryByRole('option', { name: 'Number' })).toBeNull()
    expect(screen.getByRole('option', { name: 'Created' })).toBeInTheDocument()
    unmount()

    render(
      <ViewSheet open onOpenChange={() => {}} mode='create' numbered fields={[]} classes={[createMockEntityClass()]} onCreate={vi.fn()} />
    )
    openSort()
    expect(screen.getByRole('option', { name: 'Number' })).toBeInTheDocument()
  })

  it('keeps Number listed for a view that already sorts by it', () => {
    render(
      <ViewSheet
        open
        onOpenChange={() => {}}
        mode='edit'
        fields={[]}
        classes={[createMockEntityClass()]}
        view={createMockEntityView({ sort: 'number' })}
        onUpdate={vi.fn()}
      />
    )
    const trigger = screen.getAllByRole('combobox').find((el) => el.textContent?.includes('Number')) as HTMLElement
    expect(trigger).toBeDefined()
  })

  it('leads Add view with the add glyph', () => {
    render(
      <ViewSheet open onOpenChange={() => {}} mode='create' fields={[]} classes={[createMockEntityClass()]} onCreate={vi.fn()} />
    )
    const add = screen.getByRole('button', { name: 'Add view' })
    expect(add.querySelector('svg.lucide-plus')).not.toBeNull()
  })
})
