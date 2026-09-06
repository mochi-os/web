// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: AGPL-3.0-only
// This file is part of Mochi, licensed under the GNU AGPL v3 with the
// Mochi Application Interface Exception - see license.txt and license-exception.md.

import { describe, expect, it } from 'vitest'
import { compareVersions } from './utils'

describe('compareVersions', () => {
  it('orders numerically, not lexically', () => {
    expect(compareVersions('1.13', '1.2')).toBeGreaterThan(0)
    expect(compareVersions('0.9', '0.10')).toBeLessThan(0)
    expect(compareVersions('1.0', '1.0.0')).toBe(0)
  })

  it('ranks a bare version above any suffixed form of the same number', () => {
    expect(compareVersions('2.0', '2.0-rc2')).toBeGreaterThan(0)
    expect(compareVersions('2.0-rc2', '2.0')).toBeLessThan(0)
    expect(compareVersions('1.0b', '1.0')).toBeLessThan(0)
  })

  it('orders two suffixed versions by their text so they never tie', () => {
    expect(compareVersions('2.0-rc2', '2.0-rc1')).toBeGreaterThan(0)
    expect(compareVersions('2.0-rc1', '2.0-rc2')).toBeLessThan(0)
    expect(compareVersions('2.0-rc1', '2.0-rc1')).toBe(0)
  })

  it('reads the leading digits of a suffixed segment as its number', () => {
    expect(compareVersions('1.2-rc1', '1.1')).toBeGreaterThan(0)
    expect(compareVersions('1.1', '1.2-rc1')).toBeLessThan(0)
  })
})
