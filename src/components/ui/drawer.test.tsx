// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: Apache-2.0

// The mobile half of a responsive dialog: a drawer closes on a pointer-down
// outside itself, and the error toast beside a failed submit is outside.

import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { ThemeProvider } from '../../context/theme-provider'
import { toast } from '../../lib/toast-utils'
import {
  Drawer,
  DrawerContent,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from './drawer'
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

// Header, body and footer share one edge only while the drawer owns the side
// inset. Padding moved back onto the children covers the first body block and
// nothing after it, and a width a caller meant for the desktop dialog pins a
// narrow sheet to the left edge between 640 and 767px.
describe('DrawerContent layout', () => {
  it('owns the side inset and ignores caller widths', async () => {
    render(
      <ThemeProvider>
        <Drawer open direction='bottom'>
          <DrawerContent className='sm:max-w-md'>
            <DrawerHeader>
              <DrawerTitle>Edit</DrawerTitle>
            </DrawerHeader>
            <p>First</p>
            <p>Second</p>
            <DrawerFooter>
              <button type='button'>Save</button>
            </DrawerFooter>
          </DrawerContent>
        </Drawer>
      </ThemeProvider>
    )
    await settle()

    const content = document.querySelector('[data-slot=drawer-content]')!
    const header = document.querySelector('[data-slot=drawer-header]')!
    const footer = document.querySelector('[data-slot=drawer-footer]')!
    expect(content.className).toMatch(/(^|\s)px-4(\s|$)/)
    expect(content.className).toContain(
      'data-[vaul-drawer-direction=bottom]:max-w-none'
    )
    // vaul's ::after strip would otherwise scroll into view below the footer.
    expect(content.className).toMatch(/(^|\s)after:hidden(\s|$)/)
    for (const part of [header, footer]) {
      expect(part.className).not.toMatch(/(^|\s)(p|px)-\d/)
    }
    expect(
      document.querySelector('[data-slot=drawer-handle]')?.nextElementSibling
    ).toBe(header)
  })
})
