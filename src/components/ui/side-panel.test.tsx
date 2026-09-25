// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: Apache-2.0

// Every side panel opens through SidePanel, so what it promises is pinned here:
// one close button in the header, a tap outside that closes only when the panel
// asks for it, a toast that never counts as outside, and no Radix warning for a
// panel with nothing to describe.

import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { i18n } from '@lingui/core'
import { I18nProvider } from '@lingui/react'
import { ThemeProvider } from '../../context/theme-provider'
import { toast } from '../../lib/toast-utils'
import { Toaster } from './sonner'
import {
  SidePanel,
  SidePanelBody,
  SidePanelFooter,
  SidePanelHeader,
  SidePanelTitle,
} from './side-panel'

function Fixture({
  onOpenChange,
  ...props
}: {
  onOpenChange: (open: boolean) => void
  dismissOnOutsideClick?: boolean
  description?: string
}) {
  return (
    <ThemeProvider>
      <I18nProvider i18n={i18n}>
        <SidePanel open onOpenChange={onOpenChange} {...props}>
          <SidePanelHeader actions={<button>Watch</button>}>
            <SidePanelTitle>Theme</SidePanelTitle>
          </SidePanelHeader>
          <SidePanelBody>Body</SidePanelBody>
          <SidePanelFooter>Footer</SidePanelFooter>
        </SidePanel>
        <Toaster />
        <p>elsewhere</p>
      </I18nProvider>
    </ThemeProvider>
  )
}

// Radix attaches its outside-pointer listener a tick after mount.
async function settle() {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0))
  })
}

function press(target: Element) {
  fireEvent.pointerDown(target)
  fireEvent.click(target)
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe('SidePanel', () => {
  it('renders the title, actions, body and footer under one dialog', () => {
    render(<Fixture onOpenChange={vi.fn()} />)

    const dialog = screen.getByRole('dialog', { name: 'Theme' })
    expect(dialog).toHaveTextContent('Watch')
    expect(dialog).toHaveTextContent('Body')
    expect(dialog).toHaveTextContent('Footer')
  })

  it('closes from the one close button in the header', () => {
    const onOpenChange = vi.fn()
    render(<Fixture onOpenChange={onOpenChange} />)

    expect(screen.getAllByRole('button', { name: 'Close' })).toHaveLength(1)
    fireEvent.click(screen.getByRole('button', { name: 'Close' }))

    expect(onOpenChange).toHaveBeenCalledWith(false)
  })

  // The panel sits at the end edge, which is the left in right-to-left
  // pages, so the arrow has to turn round with it.
  it('mirrors the close arrow in right-to-left pages', () => {
    render(<Fixture onOpenChange={() => {}} />)

    const arrow = screen
      .getByRole('button', { name: 'Close' })
      .querySelector('svg')
    expect(arrow).toHaveClass('rtl:-scale-x-100')
  })

  it('stays open on a tap outside by default', async () => {
    const onOpenChange = vi.fn()
    render(<Fixture onOpenChange={onOpenChange} />)
    await settle()

    press(screen.getByText('elsewhere'))

    expect(onOpenChange).not.toHaveBeenCalled()
  })

  it('closes on a tap outside when the panel asks for it', async () => {
    const onOpenChange = vi.fn()
    render(<Fixture onOpenChange={onOpenChange} dismissOnOutsideClick />)
    await settle()

    press(screen.getByText('elsewhere'))

    expect(onOpenChange).toHaveBeenCalledWith(false)
  })

  it('stays open when the tap lands on a toast', async () => {
    const onOpenChange = vi.fn()
    render(<Fixture onOpenChange={onOpenChange} dismissOnOutsideClick />)
    act(() => {
      toast.error('Boom')
    })
    const copy = await waitFor(() => {
      const button = document.querySelector('[data-sonner-toast] [data-button]')
      if (!button) throw new Error('no copy button yet')
      return button
    })
    await settle()

    press(copy)

    expect(onOpenChange).not.toHaveBeenCalled()
  })

  it('names the dialog from the label when the title is custom', () => {
    render(
      <ThemeProvider>
        <I18nProvider i18n={i18n}>
          <SidePanel open onOpenChange={vi.fn()} label='Item details'>
            <SidePanelHeader>
              <input aria-label='Title' defaultValue='Fix the door' />
            </SidePanelHeader>
          </SidePanel>
        </I18nProvider>
      </ThemeProvider>
    )

    expect(
      screen.getByRole('dialog', { name: 'Item details' })
    ).toBeInTheDocument()
  })

  it('describes the dialog only when it is given a description', () => {
    const { unmount } = render(<Fixture onOpenChange={vi.fn()} />)
    expect(screen.getByRole('dialog')).not.toHaveAttribute('aria-describedby')
    unmount()

    render(<Fixture onOpenChange={vi.fn()} description='Pick a theme' />)
    expect(screen.getByRole('dialog')).toHaveAccessibleDescription(
      'Pick a theme'
    )
  })

  it('does not warn about a missing description', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    render(<Fixture onOpenChange={vi.fn()} />)

    expect(warn).not.toHaveBeenCalled()
  })
})
