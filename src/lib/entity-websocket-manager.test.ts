// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: Apache-2.0

// The two lifecycle races that made boards deliver every event N times: a
// close() completes asynchronously, so a replacement connection opened in the
// CLOSING window used to be torn out of the map by the dying socket's own
// onclose, leaving an orphan socket that still fanned events out to
// subscribers — one more per token-refresh cycle.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { entityWebsocketManager, type EntityWebsocketEvent } from './entity-websocket-manager'

class MockWebSocket {
  static CONNECTING = 0
  static OPEN = 1
  static CLOSING = 2
  static CLOSED = 3
  static instances: MockWebSocket[] = []

  url: string
  readyState = MockWebSocket.CONNECTING
  onopen: (() => void) | null = null
  onmessage: ((event: { data: string }) => void) | null = null
  onclose: (() => void) | null = null
  onerror: (() => void) | null = null
  closeCalled = false

  constructor(url: string) {
    this.url = url
    MockWebSocket.instances.push(this)
  }

  close() {
    this.closeCalled = true
    this.readyState = MockWebSocket.CLOSING
  }

  // Test drivers
  open() {
    this.readyState = MockWebSocket.OPEN
    this.onopen?.()
  }

  finishClose() {
    this.readyState = MockWebSocket.CLOSED
    this.onclose?.()
  }

  deliver(event: EntityWebsocketEvent) {
    this.onmessage?.({ data: JSON.stringify(event) })
  }
}

function socketsFor(key: string): MockWebSocket[] {
  return MockWebSocket.instances.filter((ws) => ws.url.includes(`key=${key}`))
}

describe('entityWebsocketManager', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    MockWebSocket.instances = []
    vi.stubGlobal('WebSocket', MockWebSocket)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.useRealTimers()
  })

  it('closes the connection when the last subscriber leaves, with handlers detached', () => {
    const unsubscribe = entityWebsocketManager.subscribe('kA', () => {})
    const [ws] = socketsFor('kA')
    ws.open()

    unsubscribe()

    expect(ws.closeCalled).toBe(true)
    expect(ws.onclose).toBeNull()
    expect(ws.onmessage).toBeNull()
  })

  it('a resubscribe during the old socket close cannot orphan a connection', () => {
    // The token-refresh cycle: unsubscribe (last subscriber, socket closing
    // asynchronously) then immediately subscribe again.
    const unsubscribe = entityWebsocketManager.subscribe('kB', () => {})
    const [first] = socketsFor('kB')
    first.open()
    unsubscribe()

    const received: string[] = []
    entityWebsocketManager.subscribe('kB', (event) => received.push(event.type))
    expect(socketsFor('kB')).toHaveLength(2)
    const second = socketsFor('kB')[1]
    second.open()

    // The dying socket's close lands after the replacement exists. Detached
    // handlers mean it cannot delete the replacement or schedule a reconnect.
    first.finishClose()
    vi.runAllTimers()

    expect(socketsFor('kB')).toHaveLength(2)
    second.deliver({ type: 'ping' })
    expect(received).toEqual(['ping'])
  })

  it('a server-initiated close cannot tear down its replacement', () => {
    // The server closes the socket (handlers still attached, state CLOSING);
    // a new subscriber arrives in that window and opens a replacement.
    const received: string[] = []
    entityWebsocketManager.subscribe('kC', (event) => received.push(`a:${event.type}`))
    const [first] = socketsFor('kC')
    first.open()
    first.readyState = MockWebSocket.CLOSING

    entityWebsocketManager.subscribe('kC', (event) => received.push(`b:${event.type}`))
    expect(socketsFor('kC')).toHaveLength(2)
    const second = socketsFor('kC')[1]
    second.open()

    // The old socket's onclose fires late. The identity guard must keep it
    // from deleting the live replacement and spawning a third connection.
    first.finishClose()
    vi.runAllTimers()

    expect(socketsFor('kC')).toHaveLength(2)
    second.deliver({ type: 'ping' })
    expect(received).toEqual(['a:ping', 'b:ping'])
  })
})
