// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: Apache-2.0

// The token belongs in the handshake's subprotocol, never its URL.

import { describe, expect, it } from 'vitest'
import { websocketProtocols } from './websocket-token'

describe('websocket token presentation', () => {
  it('offers the token as a subprotocol', () => {
    expect(websocketProtocols('Bearer abc')).toEqual(['mochi.token.abc'])
    expect(websocketProtocols('abc')).toEqual(['mochi.token.abc'])
  })

  it('presents nothing at all without a token', () => {
    expect(websocketProtocols(undefined)).toBeUndefined()
    expect(websocketProtocols('')).toBeUndefined()
  })
})
