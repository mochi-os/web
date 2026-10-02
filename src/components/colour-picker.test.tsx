// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: Apache-2.0

import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { I18nProvider } from '@lingui/react'
import { i18n } from '@lingui/core'
import { ColourPicker, PRESET_COLOURS } from './colour-picker'

function show(value: string) {
  return render(
    <I18nProvider i18n={i18n}>
      <ColourPicker
        collapsible
        value={value}
        onChange={vi.fn()}
        onClear={vi.fn()}
      />
    </I18nProvider>
  )
}

describe('ColourPicker collapsible', () => {
  it('puts the custom toggle on the row of preset swatches', () => {
    const { container } = show(PRESET_COLOURS[2])
    const swatch = container.querySelector(`button[style*="background-color"]`)!
    const custom = screen.getByRole('button', { name: /custom/i })
    expect(custom.parentElement).toBe(swatch.parentElement!.parentElement)
  })

  it('wraps the swatches among themselves, so the toggle never drops to a line of its own', () => {
    const { container } = show(PRESET_COLOURS[2])
    const swatch = container.querySelector(`button[style*="background-color"]`)!
    const custom = screen.getByRole('button', { name: /custom/i })
    const row = custom.parentElement!
    const swatches = swatch.parentElement!
    expect(row.className).not.toContain('flex-wrap')
    expect(swatches.className).toContain('flex-wrap')
    // The swatches give way to the toggle, never the toggle to them.
    expect(swatches.className).toContain('min-w-0')
    expect(custom.className).toContain('shrink-0')
  })

  it('keeps clear on a row of its own below the swatches', () => {
    const { container } = show(PRESET_COLOURS[2])
    const swatch = container.querySelector(`button[style*="background-color"]`)!
    const clear = screen.getByRole('button', { name: /clear/i })
    expect(clear.parentElement).not.toBe(swatch.parentElement)
  })

  it('opens the picker below the swatch row', () => {
    const { container } = show(PRESET_COLOURS[2])
    const canvas = container.querySelector('canvas')!
    const picker = canvas.parentElement!
    expect(picker.className).toContain('hidden')

    const custom = screen.getByRole('button', { name: /custom/i })
    expect(custom.getAttribute('aria-expanded')).toBe('false')
    fireEvent.click(custom)
    expect(picker.className).not.toContain('hidden')
    expect(custom.getAttribute('aria-expanded')).toBe('true')

    // The picker follows the swatch row, not sits inside it.
    const row = custom.parentElement!
    expect(row.contains(picker)).toBe(false)
    expect(
      row.compareDocumentPosition(picker) & Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy()
  })
})
