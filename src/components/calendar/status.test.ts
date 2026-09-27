// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: Apache-2.0

import { describe, it, expect } from 'vitest'
import { eventStatus } from './status'

describe('eventStatus', () => {
  it('reads cancelled and tentative in any case, and nothing else', () => {
    expect(eventStatus('CANCELLED')).toBe('cancelled')
    expect(eventStatus('tentative')).toBe('tentative')
    expect(eventStatus('CONFIRMED')).toBeUndefined()
    expect(eventStatus('')).toBeUndefined()
    expect(eventStatus(undefined)).toBeUndefined()
  })
})
