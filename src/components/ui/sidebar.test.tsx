// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: Apache-2.0

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { I18nProvider } from '@lingui/react'
import { i18n } from '@lingui/core'
import {
  SidebarProvider,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarRail,
  SidebarResizeHandle,
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

// The handle reads the sidebar it sits in from the DOM around it, the same
// slots Sidebar renders, so the test builds those slots without the signed-in
// guard Sidebar carries.
function renderHandle(
  options: { defaultOpen?: boolean; rtl?: boolean; drawn?: number } = {}
) {
  const result = render(
    <I18nProvider i18n={i18n}>
      <SidebarProvider defaultOpen={options.defaultOpen ?? true}>
        <div data-slot='sidebar' data-side='left'>
          <div data-slot='sidebar-container'>
            <SidebarResizeHandle
              style={options.rtl ? { direction: 'rtl' } : undefined}
            />
          </div>
        </div>
      </SidebarProvider>
    </I18nProvider>
  )
  const container = result.container.querySelector<HTMLElement>(
    '[data-slot=sidebar-container]'
  )!
  container.getBoundingClientRect = () =>
    ({ width: options.drawn ?? 256 }) as DOMRect
  const wrapper = result.container.querySelector<HTMLElement>(
    '[data-slot=sidebar-wrapper]'
  )!
  return {
    ...result,
    wrapper,
    width: () => wrapper.style.getPropertyValue('--sidebar-width'),
    handle: () => screen.queryByRole('separator', { name: 'Resize sidebar' }),
  }
}

const savedCookie = () =>
  document.cookie
    .split('; ')
    .find((c) => c.startsWith('sidebar_width='))
    ?.split('=')[1]

describe('SidebarResizeHandle', () => {
  const innerWidth = window.innerWidth

  beforeEach(() => {
    // jsdom has neither pointer capture nor a frame clock to wait on.
    HTMLElement.prototype.setPointerCapture = vi.fn()
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
      cb(0)
      return 1
    })
    window.innerWidth = 1280
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    window.innerWidth = innerWidth
    document.cookie = 'sidebar_width=; path=/; max-age=0'
    document.body.removeAttribute('style')
  })

  it('widens the sidebar as it is dragged and saves the width on release', () => {
    const { handle, width, wrapper } = renderHandle()
    fireEvent.pointerDown(handle()!, { pointerId: 1, button: 0, clientX: 100 })
    // Easing is off while dragging, and the page selects no text.
    expect(wrapper).toHaveAttribute('data-resizing', 'true')
    expect(document.body.style.userSelect).toBe('none')

    fireEvent.pointerMove(handle()!, { pointerId: 1, clientX: 164 })
    expect(width()).toBe('320px')
    // Nothing is saved until the pointer lets go.
    expect(savedCookie()).toBeUndefined()

    fireEvent.pointerUp(handle()!, { pointerId: 1 })
    expect(savedCookie()).toBe('320')
    expect(width()).toBe('320px')
    expect(wrapper).not.toHaveAttribute('data-resizing')
    expect(document.body.style.userSelect).toBe('')
  })

  it('stops at the limits however far it is dragged', () => {
    const { handle, width } = renderHandle()
    fireEvent.pointerDown(handle()!, { pointerId: 1, button: 0, clientX: 100 })
    fireEvent.pointerMove(handle()!, { pointerId: 1, clientX: 2000 })
    fireEvent.pointerUp(handle()!, { pointerId: 1 })
    expect(width()).toBe('448px')

    fireEvent.pointerDown(handle()!, { pointerId: 2, button: 0, clientX: 500 })
    fireEvent.pointerMove(handle()!, { pointerId: 2, clientX: -2000 })
    fireEvent.pointerUp(handle()!, { pointerId: 2 })
    expect(width()).toBe('224px')
  })

  it('widens a right-to-left sidebar when dragged to the left', () => {
    const { handle } = renderHandle({ rtl: true })
    fireEvent.pointerDown(handle()!, { pointerId: 1, button: 0, clientX: 500 })
    fireEvent.pointerMove(handle()!, { pointerId: 1, clientX: 436 })
    fireEvent.pointerUp(handle()!, { pointerId: 1 })
    expect(savedCookie()).toBe('320')
  })

  it('ignores a press with any button but the main one', () => {
    const { handle, wrapper } = renderHandle()
    fireEvent.pointerDown(handle()!, { pointerId: 1, button: 2, clientX: 100 })
    fireEvent.pointerMove(handle()!, { pointerId: 1, clientX: 164 })
    expect(wrapper).not.toHaveAttribute('data-resizing')
    expect(savedCookie()).toBeUndefined()
  })

  it('goes back to the default width on a double-click', () => {
    document.cookie = 'sidebar_width=320; path=/'
    const { handle, width } = renderHandle()
    expect(width()).toBe('320px')
    fireEvent.doubleClick(handle()!)
    expect(width()).toBe('16rem')
    expect(savedCookie()).toBeUndefined()
  })

  it('resizes from the keyboard with the arrows, Home and End', () => {
    const { handle, width } = renderHandle()
    expect(handle()).toHaveAttribute('tabindex', '0')
    fireEvent.keyDown(handle()!, { key: 'ArrowRight' })
    expect(width()).toBe('272px')
    fireEvent.keyDown(handle()!, { key: 'Home' })
    expect(width()).toBe('224px')
    fireEvent.keyDown(handle()!, { key: 'End' })
    expect(width()).toBe('448px')
  })

  it('narrows a saved width to fit a smaller window without forgetting it', () => {
    document.cookie = 'sidebar_width=448; path=/'
    window.innerWidth = 1024
    const { width } = renderHandle()
    expect(width()).toBe('409px')
    expect(savedCookie()).toBe('448')
  })

  it('is not offered on a phone or tablet, which keep the fixed widths', () => {
    document.cookie = 'sidebar_width=320; path=/'
    window.innerWidth = 900
    const { handle, width } = renderHandle()
    expect(handle()).toBeNull()
    expect(width()).toBe('16rem')
  })

  it('is not offered while the sidebar is collapsed', () => {
    const { handle } = renderHandle({ defaultOpen: false })
    expect(handle()).toBeNull()
  })

  it('keeps the width and restores the page when collapsed mid-drag', () => {
    const { handle, wrapper } = renderHandle()
    fireEvent.pointerDown(handle()!, { pointerId: 1, button: 0, clientX: 100 })
    fireEvent.pointerMove(handle()!, { pointerId: 1, clientX: 164 })
    fireEvent.keyDown(window, { key: 'b', ctrlKey: true })
    expect(handle()).toBeNull()
    expect(savedCookie()).toBe('320')
    expect(wrapper).not.toHaveAttribute('data-resizing')
    expect(document.body.style.userSelect).toBe('')
  })
})
