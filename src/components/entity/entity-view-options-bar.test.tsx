// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: Apache-2.0

import { describe, it, expect, vi } from 'vitest'
import {
  render,
  screen,
  fireEvent,
  createMockEntityView,
} from './entity-test-utils'

const screen_ = vi.hoisted(() => ({ size: 'xs', width: 360 }))
vi.mock('../../hooks/use-screen-size', () => ({
  useScreenSize: () => screen_,
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
    const description = await screen.findByText(
      'Search, watch, and sort this view.'
    )
    expect(description.className).toContain('sr-only')
  })

  it('keeps the compact bar and its sheet up to 1024 px', async () => {
    // A tablet cannot fit the tabs, a 200 px search, Watched and the sort
    // controls on one line, so it gets the phone's icon and sheet.
    screen_.size = 'md'
    screen_.width = 800
    try {
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
      const open = screen.getByRole('button', { name: 'Open view controls' })
      // jsdom applies no media queries, so the classes say which bar shows.
      expect(open.closest('.sticky')?.className).toContain('lg:hidden')
      expect(
        screen.getByPlaceholderText('Search...').closest('.hidden')?.className
      ).toContain('lg:block')
      fireEvent.click(open)
      expect(
        await screen.findByText('Search, watch, and sort this view.')
      ).toBeInTheDocument()
    } finally {
      screen_.size = 'xs'
      screen_.width = 360
    }
  })
})
