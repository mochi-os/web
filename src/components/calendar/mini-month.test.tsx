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
  it('fills today as a rectangle in the primary colour with contrasting text', () => {
    show('2026-09-22')
    const today = screen.getByRole('button', { name: '22' })
    expect(today.classList.contains('bg-primary')).toBe(true)
    expect(today.classList.contains('text-primary-foreground')).toBe(true)
    expect(today.classList.contains('rounded-full')).toBe(false)
  })

  it('leaves every other day unfilled', () => {
    show('2026-09-22')
    for (const name of ['21', '23', '15']) {
      const day = screen.getByRole('button', { name })
      expect(day.classList.contains('bg-primary')).toBe(false)
    }
  })
})
