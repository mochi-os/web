// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: Apache-2.0

import { forwardRef } from 'react'
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { I18nProvider } from '@lingui/react'
import { i18n } from '@lingui/core'

vi.mock('@tanstack/react-router', () => ({
  Link: forwardRef<HTMLAnchorElement, { to: unknown; children?: React.ReactNode; preload?: unknown }>(
    function Link({ to, children, preload: _preload, ...rest }, ref) {
      return (
        <a ref={ref} data-router-link href={String(to)} {...rest}>
          {children}
        </a>
      )
    }
  ),
  useLocation: ({ select }: { select: (location: { pathname: string }) => unknown }) => select({ pathname: '/' }),
}))

import { SidebarProvider } from '../ui/sidebar'
import { NavGroup } from './nav-group'
import type { NavItem } from './types'

const items: NavItem[] = [
  {
    title: 'Section',
    open: true,
    items: [
      { title: 'Inside', url: '/inside' },
      { title: 'Outside', url: 'https://other.example/x', external: true },
      { title: 'Nested', items: [{ title: 'Leaf', url: '/leaf' }] },
    ],
  },
]

function show(defaultOpen: boolean) {
  render(
    <I18nProvider i18n={i18n}>
      <SidebarProvider defaultOpen={defaultOpen}>
        <NavGroup title='Group' items={items} />
      </SidebarProvider>
    </I18nProvider>
  )
}

describe('NavGroup sub-items', () => {
  it('renders an external sub-item as a plain anchor, not a router link', () => {
    show(true)
    const outside = screen.getByText('Outside').closest('a')!
    expect(outside.getAttribute('href')).toBe('https://other.example/x')
    expect(outside.hasAttribute('data-router-link')).toBe(false)
    const inside = screen.getByText('Inside').closest('a')!
    expect(inside.hasAttribute('data-router-link')).toBe(true)
  })

  it('keeps a nested section reachable from the collapsed-sidebar dropdown', async () => {
    show(false)
    fireEvent.keyDown(screen.getByText('Section'), { key: 'Enter' })
    // The nested section is a flyout; its leaf has to be reachable from it,
    // not merely listed as a dead item.
    const nested = await screen.findByText('Nested')
    fireEvent.click(nested.closest('[role="menuitem"]') as HTMLElement)
    expect(await screen.findByText('Leaf')).toBeInTheDocument()
  })
})
