// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: Apache-2.0

// Presenting an app token on a websocket handshake.
//
// A browser sets no headers on a handshake, so the token used to travel in the
// query string, where it lands in every access log and in any URL a viewer
// copies. Core reads it from Sec-WebSocket-Protocol instead - the one header a
// browser will send - and echoes the protocol back.
//
// A server too old to read it selects no protocol, and the browser then fails
// the handshake before it ever opens. That is the shape this module watches
// for: the first such failure drops the page back to the query form, which
// every core still accepts, so a client ahead of its server keeps working.

const PREFIX = 'mochi.token.'

// Whether this page has fallen back to the query form, and whether any
// subprotocol handshake has ever opened. Page-scoped: a reload re-probes.
let legacy = false
let opened = false

function bare(token?: string | null): string {
  if (!token) return ''
  return token.startsWith('Bearer ') ? token.slice(7) : token
}

// websocketProtocols is what to pass as the WebSocket constructor's second
// argument: the token as a subprotocol, or nothing once the page knows the
// server ignores it.
export function websocketProtocols(token?: string | null): string[] | undefined {
  const value = bare(token)
  if (!value || legacy) return undefined
  return [PREFIX + value]
}

// websocketQueryToken is the token to put in the handshake URL instead, which
// is nothing at all unless the page has fallen back.
export function websocketQueryToken(token?: string | null): string | undefined {
  const value = bare(token)
  if (!value || !legacy) return undefined
  return value
}

// websocketOpened records a handshake that carried the subprotocol and opened,
// which settles the question for the rest of the page: a later failure is a
// dropped connection, not an old server.
export function websocketOpened(protocols?: string[]): void {
  if (protocols?.length) opened = true
}

// websocketFailed records a socket that closed without ever opening. Before
// anything has connected that is how an old server looks - but so does an
// offline browser, which is why that case is excluded rather than counted.
export function websocketFailed(protocols?: string[]): void {
  if (!protocols?.length || opened || legacy) return
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return
  legacy = true
}

// websocketTokenReset is for tests, which each need a fresh page's state.
export function websocketTokenReset(): void {
  legacy = false
  opened = false
}
