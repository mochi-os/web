// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: Apache-2.0

import { describe, it, expect, afterEach } from 'vitest'
import { themeColor } from './theme-color'

afterEach(() => {
  document.documentElement.style.removeProperty('--background')
})

describe('themeColor', () => {
  it('takes the background token the active theme defines', () => {
    document.documentElement.style.setProperty('--background', 'oklch(0.2 0.05 250)')
    expect(themeColor('light')).toBe('oklch(0.2 0.05 250)')
  })

  it('falls back to the plain pair only when no theme has painted the root', () => {
    expect(themeColor('dark')).toBe('#1a1a1a')
    expect(themeColor('light')).toBe('#fff')
  })
})
