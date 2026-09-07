// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: Apache-2.0

import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { I18nProvider } from '@lingui/react'
import { i18n } from '@lingui/core'
import { SidebarProvider, SidebarMenu, SidebarMenuItem, SidebarMenuButton, SidebarRail } from './sidebar'

describe('Sidebar', () => {
  it('trims the active item\'s start padding, whichever side that is', () => {
    render(
      <I18nProvider i18n={i18n}>
        <SidebarProvider>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton isActive>Feeds</SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarProvider>
      </I18nProvider>
    )
    const button = screen.getByRole('button', { name: 'Feeds' })
    expect(button.className).toContain('data-[active=true]:ps-[6px]')
    expect(button.className).not.toContain('pl-[6px]')
  })

  it('labels the rail with the same sentence-case phrase as the trigger', () => {
    render(
      <I18nProvider i18n={i18n}>
        <SidebarProvider>
          <SidebarRail />
        </SidebarProvider>
      </I18nProvider>
    )
    expect(screen.getByRole('button', { name: 'Toggle sidebar' })).toBeInTheDocument()
  })
})
