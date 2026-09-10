// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: Apache-2.0

// A modal dialog closes on a pointer-down outside itself. A toast is outside
// by design: a failed submit leaves the form open with the error toast beside
// it, and copying that error must not throw the form away.

import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { i18n } from '@lingui/core'
import { I18nProvider } from '@lingui/react'
import { ThemeProvider } from '../../context/theme-provider'
import { toast } from '../../lib/toast-utils'
import { Dialog, DialogContent, DialogTitle } from './dialog'
import { Toaster } from './sonner'

function Fixture({ onOpenChange }: { onOpenChange: (open: boolean) => void }) {
  return (
    <ThemeProvider>
      <I18nProvider i18n={i18n}>
        <Dialog open onOpenChange={onOpenChange}>
          <DialogContent>
            <DialogTitle>Edit</DialogTitle>
          </DialogContent>
        </Dialog>
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

async function raiseToast() {
  act(() => {
    toast.error('Boom')
  })
  return waitFor(() => {
    const copy = document.querySelector('[data-sonner-toast] [data-button]')
    if (!copy) throw new Error('no copy button yet')
    return copy
  })
}

function press(target: Element) {
  fireEvent.pointerDown(target)
  fireEvent.click(target)
}

describe('DialogContent beside a toast', () => {
  it('stays open when the pointer lands on the toast', async () => {
    const onOpenChange = vi.fn()
    render(<Fixture onOpenChange={onOpenChange} />)
    const copy = await raiseToast()
    await settle()

    press(copy)

    expect(onOpenChange).not.toHaveBeenCalled()
  })

  it('still closes on a pointer anywhere else outside', async () => {
    const onOpenChange = vi.fn()
    render(<Fixture onOpenChange={onOpenChange} />)
    await raiseToast()
    await settle()

    press(screen.getByText('elsewhere'))

    expect(onOpenChange).toHaveBeenCalledWith(false)
  })

  it('still hands the event to the caller', async () => {
    const onOpenChange = vi.fn()
    const onPointerDownOutside = vi.fn()
    render(
      <ThemeProvider>
        <I18nProvider i18n={i18n}>
          <Dialog open onOpenChange={onOpenChange}>
            <DialogContent onPointerDownOutside={onPointerDownOutside}>
              <DialogTitle>Edit</DialogTitle>
            </DialogContent>
          </Dialog>
          <Toaster />
        </I18nProvider>
      </ThemeProvider>
    )
    const copy = await raiseToast()
    await settle()

    press(copy)

    expect(onPointerDownOutside).toHaveBeenCalledTimes(1)
    expect(onOpenChange).not.toHaveBeenCalled()
  })
})
