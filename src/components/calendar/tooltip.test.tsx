// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: Apache-2.0

import type { ReactNode } from 'react'
import { describe, it, expect } from 'vitest'
import { renderHook } from '@testing-library/react'
import { I18nProvider } from '@lingui/react'
import { i18n } from '@lingui/core'
import { useEventTooltip } from './tooltip'

const wrapper = ({ children }: { children: ReactNode }) => (
  <I18nProvider i18n={i18n}>{children}</I18nProvider>
)

const noon = Date.UTC(2026, 8, 25, 12) / 1000

describe('useEventTooltip', () => {
  it('reads an HTML description as text, with its line breaks', () => {
    const { result } = renderHook(() => useEventTooltip(), { wrapper })
    const text = result.current({
      key: 'e1',
      title: 'DUB:2-DEN 15:25-18:15',
      colour: '#60a5fa',
      start: noon,
      finish: noon + 3600,
      allday: false,
      location: 'EI59',
      description: 'PNR: 2YHEIJ&nbsp;<br>Class: Business<br>Seats: 2K',
    })
    expect(text).toContain('PNR: 2YHEIJ\nClass: Business\nSeats: 2K')
    expect(text).not.toContain('<br>')
    expect(text).not.toContain('&nbsp;')
  })

  it('leaves a plain description as it is', () => {
    const { result } = renderHook(() => useEventTooltip(), { wrapper })
    const text = result.current({
      key: 'e2',
      title: 'Budget call',
      colour: '#60a5fa',
      start: noon,
      finish: noon + 3600,
      allday: false,
      description: 'Bring the numbers\na < b',
    })
    expect(text).toContain('Bring the numbers\na < b')
  })
})
