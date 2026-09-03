// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: Apache-2.0

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { I18nProvider } from '@lingui/react'
import { i18n } from '@lingui/core'

vi.mock('../context/search-provider', () => ({
  useSearch: () => ({ open: true, setOpen: vi.fn() }),
}))
vi.mock('@tanstack/react-router', () => ({
  useNavigate: () => vi.fn(),
}))
vi.mock('../lib/shell-bridge', () => ({
  shellNavigateExternal: vi.fn(),
}))

import { shellNavigateExternal } from '../lib/shell-bridge'
import { CommandMenu } from './command-menu'
import type { SidebarData } from './layout/types'

function show(data: SidebarData) {
  render(
    <I18nProvider i18n={i18n}>
      <CommandMenu sidebarData={data} />
    </I18nProvider>
  )
}

describe('CommandMenu', () => {
  beforeEach(() => {
    vi.mocked(shellNavigateExternal).mockClear()
  })

  it('leaves the iframe through the shell for an external destination', () => {
    show({ navGroups: [{ title: 'Apps', items: [{ title: 'People', url: '/people/', external: true }] }] })
    fireEvent.click(screen.getByText('People'))
    expect(shellNavigateExternal).toHaveBeenCalledWith('/people/')
  })

  it('lists every group even when two share a title', () => {
    // Two untitled groups collide on a title key; React then warns and
    // reconciles the second group against the first on every update.
    const errors = vi.spyOn(console, 'error').mockImplementation(() => {})
    show({
      navGroups: [
        { title: '', items: [{ title: 'First', url: '/first' }] },
        { title: '', items: [{ title: 'Second', url: '/second' }] },
      ],
    })
    expect(screen.getByText('First')).toBeInTheDocument()
    expect(screen.getByText('Second')).toBeInTheDocument()
    expect(errors.mock.calls.some((call) => String(call[0]).includes('same key'))).toBe(false)
    errors.mockRestore()
  })
})
