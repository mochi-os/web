// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: Apache-2.0

import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { I18nProvider } from '@lingui/react'
import { i18n } from '@lingui/core'
import {
  SidebarProvider,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarRail,
} from './sidebar'

describe('Sidebar', () => {
  it('marks the active item with colour alone, no bar on its start edge', () => {
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
    expect(button.className).toContain('data-[active=true]:bg-sidebar-active')
    expect(button.className).toContain('data-[active=true]:text-primary')
    // A start border curled on the rounded button and squeezed the icon when
    // collapsed, and a separate bar was clipped at full radius.
    expect(button.className).not.toContain('border-s-')
    expect(button.className).not.toContain('before:')
    expect(button.closest('li')!.className).not.toContain('before:')
  })

  it('labels the rail with the same sentence-case phrase as the trigger', () => {
    render(
      <I18nProvider i18n={i18n}>
        <SidebarProvider>
          <SidebarRail />
        </SidebarProvider>
      </I18nProvider>
    )
    expect(
      screen.getByRole('button', { name: 'Toggle sidebar' })
    ).toBeInTheDocument()
  })
})
