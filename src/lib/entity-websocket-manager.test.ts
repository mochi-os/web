// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: Apache-2.0

// The close/reopen races: close() completes asynchronously, so a replacement
// opened in the CLOSING window must survive the dying socket's onclose, which
// otherwise leaves an orphan fanning every event out twice.

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

  // A flat retry means every open tab in every app hammers the server at a
  // fixed rate for as long as it is down, and they stay in lockstep because
  // they all dropped at the same moment.
  it('backs off further on each successive failure', () => {
    const stop = entityWebsocketManager.subscribe('backoff', () => {})
    // Deterministic jitter: full-jitter halves the base and adds up to half
    // again, so pinning random to 1 gives exactly the base delay.
    vi.spyOn(Math, 'random').mockReturnValue(1)

    const delays: number[] = []
    for (let i = 0; i < 4; i++) {
      const socket = MockWebSocket.instances[MockWebSocket.instances.length - 1]
      const before = MockWebSocket.instances.length
      socket.onclose?.()
      // Walk the clock until the reconnect fires, and record how long it took.
      let waited = 0
      while (MockWebSocket.instances.length === before && waited < 120000) {
        vi.advanceTimersByTime(250)
        waited += 250
      }
      delays.push(waited)
    }

    expect(delays[1]).toBeGreaterThan(delays[0])
    expect(delays[2]).toBeGreaterThan(delays[1])
    // And it stops growing rather than running away.
    expect(delays[3]).toBeLessThanOrEqual(31000)
    stop()
  })

  it('resets the backoff once a connection succeeds', () => {
    const stop = entityWebsocketManager.subscribe('reset', () => {})
    vi.spyOn(Math, 'random').mockReturnValue(1)

    // Fail twice to climb the backoff.
    for (let i = 0; i < 2; i++) {
      MockWebSocket.instances[MockWebSocket.instances.length - 1].onclose?.()
      vi.advanceTimersByTime(60000)
    }
    // Now succeed, then drop again: the next retry must be the short one, not
    // the escalated one it had climbed to.
    const socket = MockWebSocket.instances[MockWebSocket.instances.length - 1]
    socket.open()
    const before = MockWebSocket.instances.length
    socket.onclose?.()
    vi.advanceTimersByTime(1000)
    expect(MockWebSocket.instances.length).toBeGreaterThan(before)
    stop()
  })

  // Retrying against a network that cannot answer just burns the backoff, so
  // the key waits for the online event instead.
  it('defers the reconnect while offline and resumes when the network returns', () => {
    const stop = entityWebsocketManager.subscribe('offline', () => {})
    const original = Object.getOwnPropertyDescriptor(navigator, 'onLine')
    Object.defineProperty(navigator, 'onLine', { value: false, configurable: true })

    const before = MockWebSocket.instances.length
    MockWebSocket.instances[MockWebSocket.instances.length - 1].onclose?.()
    vi.advanceTimersByTime(120000)
    expect(MockWebSocket.instances.length).toBe(before)

    Object.defineProperty(navigator, 'onLine', { value: true, configurable: true })
    window.dispatchEvent(new Event('online'))
    expect(MockWebSocket.instances.length).toBeGreaterThan(before)

    if (original) Object.defineProperty(navigator, 'onLine', original)
    stop()
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
