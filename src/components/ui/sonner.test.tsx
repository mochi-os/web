// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: Apache-2.0

// A modal dialog sets pointer-events: none on the body while it is open. The
// toaster must declare its own, or every toast beside an open form is dead:
// the copy button on an error toast and the close button both ignore clicks.

import { act, render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { ThemeProvider } from '../../context/theme-provider'
import { insideToaster, toast } from '../../lib/toast-utils'
import { Toaster } from './sonner'

describe('Toaster under a modal', () => {
  it('keeps its own pointer events when the body has none', async () => {
    render(
      <ThemeProvider>
        <Toaster />
      </ThemeProvider>
    )
    document.body.style.pointerEvents = 'none'
    act(() => {
      toast.error('Boom')
    })
    await screen.findByText('Boom')

    const toaster = document.querySelector(
      '[data-sonner-toaster]'
    ) as HTMLElement
    expect(getComputedStyle(toaster).pointerEvents).toBe('auto')
    document.body.style.pointerEvents = ''
  })

  it('recognises a pointer on a toast and nothing else', async () => {
    render(
      <ThemeProvider>
        <Toaster />
        <p>elsewhere</p>
      </ThemeProvider>
    )
    act(() => {
      toast.error('Boom')
    })
    await screen.findByText('Boom')

    const copy = document.querySelector('[data-sonner-toast] [data-button]')
    expect(copy).not.toBeNull()
    expect(insideToaster(copy)).toBe(true)
    expect(insideToaster(screen.getByText('elsewhere'))).toBe(false)
    expect(insideToaster(null)).toBe(false)
  })
})
