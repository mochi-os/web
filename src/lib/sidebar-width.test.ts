// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: Apache-2.0

import { describe, it, expect } from 'vitest'
import {
  SIDEBAR_WIDTH_MAX,
  SIDEBAR_WIDTH_MIN,
  clampSidebarWidth,
  maxSidebarWidth,
  parseSidebarWidth,
} from './sidebar-width'

describe('clampSidebarWidth', () => {
  it('keeps a width inside the limits as it is, rounded', () => {
    expect(clampSidebarWidth(300.6, 1920)).toBe(301)
  })

  it('raises a width below the floor to the floor', () => {
    expect(clampSidebarWidth(40, 1920)).toBe(SIDEBAR_WIDTH_MIN)
  })

  it('lowers a width above the ceiling on a wide window', () => {
    expect(clampSidebarWidth(2000, 2560)).toBe(SIDEBAR_WIDTH_MAX)
  })

  it('lowers a width to 40% of a narrower window', () => {
    expect(maxSidebarWidth(1024)).toBe(409)
    expect(clampSidebarWidth(448, 1024)).toBe(409)
  })

  it('never goes below the floor, however narrow the window', () => {
    expect(maxSidebarWidth(300)).toBe(SIDEBAR_WIDTH_MIN)
    expect(clampSidebarWidth(448, 300)).toBe(SIDEBAR_WIDTH_MIN)
  })
})

describe('parseSidebarWidth', () => {
  it('reads a cookie string and an init number alike', () => {
    expect(parseSidebarWidth('320')).toBe(320)
    expect(parseSidebarWidth(320.4)).toBe(320)
  })

  it('has no width for a missing or malformed value', () => {
    for (const value of [undefined, null, '', ' ', 'wide', 0, -5, NaN, {}])
      expect(parseSidebarWidth(value)).toBeNull()
  })
})
