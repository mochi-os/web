// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: Apache-2.0

import type React from 'react'
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

function renderBar(
  props: Partial<React.ComponentProps<typeof EntityViewOptionsBar>> = {}
) {
  const onFilterChange = vi.fn()
  const onSortChange = vi.fn()
  render(
    <EntityViewOptionsBar
      views={[createMockEntityView()]}
      filters={{ search: '', watched: false }}
      onFilterChange={onFilterChange}
      activeViewId='view-1'
      onViewChange={vi.fn()}
      sort={null}
      onSortChange={onSortChange}
      showSort
      {...props}
    />
  )
  fireEvent.click(screen.getByRole('button', { name: 'Open view controls' }))
  return { onFilterChange, onSortChange }
}

describe('EntityViewOptionsBar', () => {
  it('keeps the view-controls description for screen readers only', async () => {
    renderBar()
    const description = await screen.findByText(
      'Search, watch, and sort this view.'
    )
    expect(description.className).toContain('sr-only')
  })

  it('opens the phone controls in the shared drawer', async () => {
    renderBar()
    const title = await screen.findByText('View controls')
    expect(title.closest('[data-slot=drawer-content]')).not.toBeNull()
    expect(document.querySelector('[data-slot=sheet-content]')).toBeNull()
  })

  it('filters to watched from the switch', async () => {
    const { onFilterChange } = renderBar()
    fireEvent.click(await screen.findByRole('switch', { name: 'Watched only' }))
    expect(onFilterChange).toHaveBeenCalledWith({ search: '', watched: true })
  })

  it('searches and clears from the drawer', async () => {
    const { onFilterChange } = renderBar({
      filters: { search: 'ldap', watched: false },
    })
    const search = await screen.findByRole('textbox', { name: 'Search' })
    fireEvent.change(search, { target: { value: 'ldap server' } })
    expect(onFilterChange).toHaveBeenCalledWith({
      search: 'ldap server',
      watched: false,
    })
    fireEvent.click(screen.getByRole('button', { name: 'Clear search' }))
    expect(onFilterChange).toHaveBeenLastCalledWith({
      search: '',
      watched: false,
    })
  })

  it('flips the sort direction from the drawer', async () => {
    const { onSortChange } = renderBar()
    fireEvent.click(await screen.findByRole('button', { name: 'Ascending' }))
    expect(onSortChange).toHaveBeenCalledWith({
      field: 'rank',
      direction: 'desc',
    })
  })

  it('leaves the sort row out where the view has no sort', async () => {
    renderBar({ showSort: false })
    await screen.findByText('View controls')
    expect(screen.queryByText('Sort')).toBeNull()
  })

  it('keeps the compact bar and its drawer up to 1024 px', async () => {
    // A tablet cannot fit the tabs, a 200 px search, Watched and the sort
    // controls on one line, so it gets the phone's icon and drawer.
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
      const title = await screen.findByText('View controls')
      expect(title.closest('[data-slot=drawer-content]')).not.toBeNull()
    } finally {
      screen_.size = 'xs'
      screen_.width = 360
    }
  })
})
