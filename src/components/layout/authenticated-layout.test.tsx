// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: Apache-2.0

// Fixture strings only. No lingui macro in this file: every app's
// lingui.config.js scans lib/web/src/**, so fixtures would be extracted.

import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { useAuthStore } from '../../stores/auth-store'
import { AuthenticatedLayout } from './authenticated-layout'
import type { SidebarData } from './types'

// The sidebar and top bar are not what this file is about: only the box the
// page itself is placed in.
vi.mock('./app-sidebar', () => ({ AppSidebar: () => null }))
vi.mock('./top-bar', () => ({ TopBar: () => null }))
vi.mock('../../hooks/use-verify-session', () => ({
  useVerifySession: () => {},
}))

const sidebar: SidebarData = {
  navGroups: [{ title: 'Group', items: [{ title: 'Item', url: '/item' }] }],
}

// The element the layout places the page in.
function body(signedIn: boolean) {
  useAuthStore.setState({
    isAuthenticated: signedIn,
    isLogoutInProgress: false,
  })
  render(
    <AuthenticatedLayout sidebarData={sidebar}>
      <div data-testid='page' />
    </AuthenticatedLayout>
  )
  return screen.getByTestId('page').parentElement!
}

describe('AuthenticatedLayout page box', () => {
  afterEach(() => {
    useAuthStore.setState({ isAuthenticated: false })
  })

  // A page with a fixed Main keeps its list in a container of its own, and
  // that container scrolls only if Main is held to the screen. In a block
  // box Main grows to its content, the container never scrolls, and a
  // load-more trigger watching it loads every page at once.
  it('places an anonymous page in a screen-high flex column', () => {
    const box = body(false)
    expect(box).toHaveClass('flex', 'flex-col', 'h-svh', 'overflow-auto')
  })

  it('places a signed-in page in a flex column as well', () => {
    const box = body(true)
    expect(box).toHaveAttribute('data-slot', 'sidebar-inset')
    expect(box).toHaveClass('flex', 'flex-col', 'overflow-auto')
  })
})
