// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: Apache-2.0

// The token belongs in the handshake's subprotocol, not its URL — and a client
// ahead of its server has to notice and fall back, or the socket never opens.

import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  websocketFailed,
  websocketOpened,
  websocketProtocols,
  websocketQueryToken,
  websocketTokenReset,
} from './websocket-token'

function online(state: boolean) {
  vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(state)
}

describe('websocket token presentation', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    websocketTokenReset()
  })

  it('offers the token as a subprotocol and keeps it out of the URL', () => {
    expect(websocketProtocols('Bearer abc')).toEqual(['mochi.token.abc'])
    expect(websocketQueryToken('Bearer abc')).toBeUndefined()
  })

  it('presents nothing at all without a token', () => {
    expect(websocketProtocols(undefined)).toBeUndefined()
    expect(websocketQueryToken('')).toBeUndefined()
  })

  it('falls back to the query form once a handshake fails before opening', () => {
    online(true)
    const protocols = websocketProtocols('abc')
    websocketFailed(protocols)
    expect(websocketProtocols('abc')).toBeUndefined()
    expect(websocketQueryToken('abc')).toBe('abc')
  })

  it('does not fall back when the browser is offline', () => {
    online(false)
    websocketFailed(websocketProtocols('abc'))
    expect(websocketProtocols('abc')).toEqual(['mochi.token.abc'])
    expect(websocketQueryToken('abc')).toBeUndefined()
  })

  it('does not fall back after a subprotocol handshake has ever opened', () => {
    online(true)
    const protocols = websocketProtocols('abc')
    websocketOpened(protocols)
    // A later drop is a lost connection, not a server that cannot read the
    // subprotocol — the token must not go back into the URL for it.
    websocketFailed(protocols)
    expect(websocketProtocols('abc')).toEqual(['mochi.token.abc'])
  })

  it('ignores a failure from a handshake that carried no subprotocol', () => {
    online(true)
    websocketFailed(undefined)
    expect(websocketProtocols('abc')).toEqual(['mochi.token.abc'])
  })
})
