// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: Apache-2.0

import { describe, it, expect, afterEach } from 'vitest'
import { detectTimezone, resolveLocale } from './locale-provider'

const preferences = {
  date_format: 'auto',
  time_format: 'auto',
  timestamp_display: 'auto',
  week_start: 'auto',
  number_format: 'auto',
  units: 'auto',
  timezone: 'auto',
}

const zone = process.env.TZ
afterEach(() => {
  if (zone === undefined) delete process.env.TZ
  else process.env.TZ = zone
})

// Node, which runs these tests, names zones as Chrome does: the device in
// India is in Asia/Calcutta.
describe("the user's zone by its current name", () => {
  it('reads the device zone by its current name', () => {
    process.env.TZ = 'Asia/Kolkata'
    expect(Intl.DateTimeFormat().resolvedOptions().timeZone).toBe(
      'Asia/Calcutta'
    )
    expect(detectTimezone()).toBe('Asia/Kolkata')
    expect(resolveLocale(preferences).timezone).toBe('Asia/Kolkata')
  })

  it('reads a preference stored under an old name by its current one', () => {
    expect(
      resolveLocale({ ...preferences, timezone: 'Europe/Kiev' }).timezone
    ).toBe('Europe/Kyiv')
    expect(
      resolveLocale({ ...preferences, timezone: 'Europe/London' }).timezone
    ).toBe('Europe/London')
  })
})
