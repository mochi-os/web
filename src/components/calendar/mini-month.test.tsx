// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: Apache-2.0

import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { I18nProvider } from '@lingui/react'
import { i18n } from '@lingui/core'
import { MiniMonth } from './mini-month'

function show(today: string) {
  render(
    <I18nProvider i18n={i18n}>
      <MiniMonth selected='2026-09-22' today={today} onSelect={vi.fn()} />
    </I18nProvider>
  )
}

describe('MiniMonth', () => {
  it("colours today's number in the primary colour on a plain background", () => {
    show('2026-09-22')
    const today = screen.getByRole('button', { name: '22' })
    expect(today.classList.contains('text-primary')).toBe(true)
    expect(today.classList.contains('font-semibold')).toBe(true)
    expect(today.classList.contains('bg-primary')).toBe(false)
    expect(today.classList.contains('text-primary-foreground')).toBe(false)
  })

  it('leaves every other day in the plain text colour', () => {
    show('2026-09-22')
    for (const name of ['21', '23', '15']) {
      const day = screen.getByRole('button', { name })
      expect(day.classList.contains('text-primary')).toBe(false)
      expect(day.classList.contains('font-semibold')).toBe(false)
    }
  })

  it('shades no day at all', () => {
    show('2026-09-22')
    const days = screen
      .getAllByRole('button')
      .filter((button) => /^\d{1,2}$/.test(button.textContent ?? ''))
    expect(days).toHaveLength(42)
    const shaded = days.filter((day) =>
      [...day.classList].some((name) => name.startsWith('bg-'))
    )
    expect(shaded).toEqual([])
  })
})
