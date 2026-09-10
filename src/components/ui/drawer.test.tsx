// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: Apache-2.0

// The mobile half of a responsive dialog: a drawer closes on a pointer-down
// outside itself, and the error toast beside a failed submit is outside.

import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { ThemeProvider } from '../../context/theme-provider'
import { toast } from '../../lib/toast-utils'
import { Drawer, DrawerContent, DrawerTitle } from './drawer'
import { Toaster } from './sonner'

function Fixture({ onOpenChange }: { onOpenChange: (open: boolean) => void }) {
  return (
    <ThemeProvider>
      <Drawer open onOpenChange={onOpenChange}>
        <DrawerContent>
          <DrawerTitle>Edit</DrawerTitle>
        </DrawerContent>
      </Drawer>
      <Toaster />
      <p>elsewhere</p>
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

describe('DrawerContent beside a toast', () => {
  it('stays open when the pointer lands on the toast', async () => {
    const onOpenChange = vi.fn()
    render(<Fixture onOpenChange={onOpenChange} />)
    const copy = await raiseToast()
    await settle()

    press(copy)

    expect(onOpenChange).not.toHaveBeenCalledWith(false)
  })

  it('still closes on a pointer anywhere else outside', async () => {
    const onOpenChange = vi.fn()
    render(<Fixture onOpenChange={onOpenChange} />)
    await raiseToast()
    await settle()

    press(screen.getByText('elsewhere'))

    expect(onOpenChange).toHaveBeenCalledWith(false)
  })
})
