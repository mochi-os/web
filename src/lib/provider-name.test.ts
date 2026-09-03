// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: Apache-2.0

import { describe, it, expect } from 'vitest'
import { providerName } from './provider-name'

describe('providerName', () => {
  it('keeps every brand verbatim, including the payment service the login map lacked', () => {
    expect(providerName('github')).toBe('GitHub')
    expect(providerName('google')).toBe('Google')
    expect(providerName('stripe-customer')).toBe('Stripe')
  })

  it('capitalises an unknown key rather than showing the raw slug', () => {
    expect(providerName('mastodon')).toBe('Mastodon')
  })
})
