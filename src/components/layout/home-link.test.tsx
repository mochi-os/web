// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: Apache-2.0

// Outside the shell each layout draws its own link home. It must carry the
// house the shell menu shows for Home, never the old mascot image, and be
// named for what it does.

import type { ReactNode } from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { I18nProvider } from '@lingui/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { i18n } from '@lingui/core'
import { useAuthStore } from '../../stores/auth-store'

const size = { isMobile: false, isTablet: false }

vi.mock('../../hooks/use-screen-size', () => ({
  useScreenSize: () => ({
    ...size,
    isDesktop: !size.isMobile && !size.isTablet,
  }),
}))

vi.mock('../../context/theme-provider', () => ({
  useTheme: () => ({ resolvedTheme: 'light' }),
}))

vi.mock('../../context/layout-provider', () => ({
  useLayout: () => ({ collapsible: 'icon' }),
}))

// Signing out is not what these tests are about, and its hook needs a query
// client.
vi.mock('../sign-out-dialog', () => ({ SignOutDialog: () => null }))

function Pass({ children }: { children?: ReactNode }) {
  return <div>{children}</div>
}

vi.mock('../ui/sidebar', () => ({
  Sidebar: Pass,
  SidebarContent: Pass,
  SidebarFooter: Pass,
  SidebarGroup: Pass,
  SidebarHeader: Pass,
  SidebarMenu: Pass,
  SidebarMenuButton: Pass,
  SidebarMenuItem: Pass,
  useSidebar: () => ({
    isMobile: size.isMobile,
    state: 'expanded',
    open: false,
    setOpenMobile: () => {},
    toggleSidebar: () => {},
  }),
}))

const { TopBar } = await import('./top-bar')
const { MochiMenu } = await import('./mochi-menu')
const { AppSidebar } = await import('./app-sidebar')

function show(node: ReactNode) {
  return render(
    <QueryClientProvider client={new QueryClient()}>
      <I18nProvider i18n={i18n}>{node}</I18nProvider>
    </QueryClientProvider>
  )
}

// The link home, whatever it is named, with nothing of the mascot about it.
function home(container: HTMLElement) {
  const link = container.querySelector<HTMLAnchorElement>('a[href="/"]')
  expect(link).not.toBeNull()
  expect(link!.querySelector('img')).toBeNull()
  expect(link!.querySelector('svg.lucide-house')).not.toBeNull()
  expect(container.querySelector('img[src*="logo-header"]')).toBeNull()
  return link!
}

beforeEach(() => {
  i18n.loadAndActivate({ locale: 'en', messages: {} })
  useAuthStore.setState({ isAuthenticated: true })
  size.isMobile = false
  size.isTablet = false
})

describe('the link home outside the shell', () => {
  it('is the house, named Home, in the top bar beside the sidebar trigger', () => {
    size.isMobile = true
    const { container } = show(<TopBar showSidebarTrigger />)
    home(container)
    expect(screen.getByRole('link', { name: 'Home' })).toBeTruthy()
  })

  it('is the house, named Home, in the top bar with a page title', () => {
    size.isMobile = true
    const { container } = show(<TopBar mobileTitle='Feeds' />)
    home(container)
    expect(screen.getByRole('link', { name: 'Home' })).toBeTruthy()
  })

  it('is the house, named Home, in the menu', () => {
    const { container } = show(<MochiMenu />)
    home(container)
    expect(screen.getByRole('link', { name: 'Home' })).toBeTruthy()
  })

  it('is the house beside the wordmark in the phone sidebar', () => {
    size.isMobile = true
    const { container } = show(<AppSidebar data={{ navGroups: [] }} />)
    expect(home(container).textContent).toBe('mochi')
  })
})
