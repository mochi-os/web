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

  it('names a hosted fediverse account by its protocol, and XMPP in capitals', () => {
    expect(providerName('fediverse')).toBe('ActivityPub')
    expect(providerName('xmpp')).toBe('XMPP')
  })

  it('capitalises an unknown key rather than showing the raw slug', () => {
    expect(providerName('mastodon')).toBe('Mastodon')
  })
})
