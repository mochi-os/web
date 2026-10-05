// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: Apache-2.0

import { afterEach, describe, expect, it } from 'vitest'
import { act, fireEvent, render, screen } from '@testing-library/react'
import { I18nProvider } from '@lingui/react'
import { i18n } from '@lingui/core'
import { useAuthStore } from '../../stores/auth-store'
import { Sidebar, SidebarProvider, useSidebar } from './sidebar'

function Toggle() {
  const { toggleSidebar } = useSidebar()
  return (
    <button type='button' data-testid='toggle' onClick={toggleSidebar}>
      toggle
    </button>
  )
}

const desktopWidth = window.innerWidth

async function openOnPhone() {
  // The sidebar draws nothing for a signed-out visitor.
  useAuthStore.setState({ isAuthenticated: true })
  render(
    <I18nProvider i18n={i18n}>
      <SidebarProvider>
        <Toggle />
        <Sidebar>
          <a href='/saved'>Saved</a>
        </Sidebar>
      </SidebarProvider>
    </I18nProvider>
  )
  // The width store only tells its readers about a change, so the phone
  // width arrives as a resize once the provider is listening.
  act(() => {
    window.innerWidth = 375
    window.dispatchEvent(new Event('resize'))
  })
  fireEvent.click(screen.getByTestId('toggle'))
  // Radix starts listening for outside presses a tick after the sheet mounts.
  await act(() => new Promise((resolve) => setTimeout(resolve, 10)))
  expect(screen.getByText('Saved')).toBeTruthy()
}

// A whole tap: the sheet acts on the click that follows the press.
async function tap(element: Element) {
  fireEvent.pointerDown(element)
  fireEvent.pointerUp(element)
  fireEvent.click(element)
  await act(() => new Promise((resolve) => setTimeout(resolve, 10)))
}

describe('Sidebar on a phone', () => {
  afterEach(() => {
    useAuthStore.setState({ isAuthenticated: false })
    window.innerWidth = desktopWidth
    window.dispatchEvent(new Event('resize'))
  })

  it('closes on a tap on the dimmed area', async () => {
    await openOnPhone()
    const overlay = document.querySelector('[data-slot=sheet-overlay]')!
    await tap(overlay)
    expect(screen.queryByText('Saved')).toBeNull()
  })

  it('closes once on a tap on the header toggle, without opening again', async () => {
    await openOnPhone()
    await tap(screen.getByTestId('toggle'))
    expect(screen.queryByText('Saved')).toBeNull()
  })
})
