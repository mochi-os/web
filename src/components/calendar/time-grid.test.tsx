// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: Apache-2.0

import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { I18nProvider } from '@lingui/react'
import { i18n } from '@lingui/core'
import { TimeGrid } from './time-grid'

const WEEK = [
  '2026-09-21',
  '2026-09-22',
  '2026-09-23',
  '2026-09-24',
  '2026-09-25',
  '2026-09-26',
  '2026-09-27',
]

function show(today: string) {
  render(
    <I18nProvider i18n={i18n}>
      <TimeGrid
        days={WEEK}
        events={[]}
        duration={60}
        hours={{ start: 8, finish: 17 }}
        workdays={[1, 2, 3, 4, 5]}
        today={today}
        onSelect={vi.fn()}
        onCreate={vi.fn()}
        onMove={vi.fn()}
        onDay={vi.fn()}
      />
    </I18nProvider>
  )
}

describe('TimeGrid', () => {
  it("fills today's column header in the primary colour with contrasting text", () => {
    show('2026-09-22')
    const header = screen.getByRole('button', { name: /22$/ })
    expect(header.classList.contains('bg-primary')).toBe(true)
    expect(header.classList.contains('text-primary-foreground')).toBe(true)
  })

  it('leaves every other header unfilled', () => {
    show('2026-09-22')
    for (const name of [/21$/, /23$/, /24$/, /25$/, /26$/, /27$/]) {
      const header = screen.getByRole('button', { name })
      expect(header.classList.contains('bg-primary')).toBe(false)
    }
  })
})
