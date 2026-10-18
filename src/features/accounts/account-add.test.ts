// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: AGPL-3.0-only
// This file is part of Mochi, licensed under the GNU AGPL v3 with the
// Mochi Application Interface Exception - see license.txt and license-exception.md.
import { describe, expect, it } from 'vitest'
import { addableProviders } from './account-add'
import type { Provider } from './types'

const provider = (type: string, capabilities: string[], flow = 'form') =>
  ({ type, capabilities, flow, fields: [], verify: false }) as unknown as Provider

describe('addableProviders', () => {
  const providers = [
    provider('email', ['notify']),
    provider('browser', ['notify']),
    provider('matrix', ['network', 'chat', 'notify'], 'handle'),
    provider('github', ['login'], 'oauth'),
  ]

  it('offers no network: its accounts are made and linked on the Networks page', () => {
    expect(addableProviders(providers, true).map((p) => p.type)).toEqual([
      'email',
      'github',
    ])
  })

  it('offers a provider that signs in only where the caller can link it', () => {
    expect(addableProviders(providers, false).map((p) => p.type)).toEqual([
      'email',
    ])
  })
})
