// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: Apache-2.0

import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, createMockEntityView } from './entity-test-utils'

vi.mock('../../hooks/use-screen-size', () => ({
  useScreenSize: () => ({ size: 'xs', width: 360 }),
}))

const { EntityViewOptionsBar } = await import('./entity-view-options-bar')

describe('EntityViewOptionsBar', () => {
  it('keeps the view-controls description for screen readers only', async () => {
    render(
      <EntityViewOptionsBar
        views={[createMockEntityView()]}
        filters={{ search: '', watched: false }}
        onFilterChange={vi.fn()}
        activeViewId='view-1'
        onViewChange={vi.fn()}
        sort={null}
        onSortChange={vi.fn()}
        showSort
      />
    )
    fireEvent.click(screen.getByRole('button', { name: 'Open view controls' }))
    const description = await screen.findByText('Search, watch, and sort this view.')
    expect(description.className).toContain('sr-only')
  })
})
