// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: Apache-2.0

// Presenting an app token on a websocket handshake.
//
// A browser sets no headers on a handshake, and the query string lands in
// every access log and in any URL a viewer copies. Core reads the token from
// Sec-WebSocket-Protocol instead - the one header a browser will send - and
// echoes the protocol back.

const PREFIX = 'mochi.token.'

function bare(token?: string | null): string {
  if (!token) return ''
  return token.startsWith('Bearer ') ? token.slice(7) : token
}

// websocketProtocols is what to pass as the WebSocket constructor's second
// argument: the token as a subprotocol, or nothing without one.
export function websocketProtocols(token?: string | null): string[] | undefined {
  const value = bare(token)
  if (!value) return undefined
  return [PREFIX + value]
}
