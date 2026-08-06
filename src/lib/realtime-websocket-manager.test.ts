// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: Apache-2.0

// The chat/game manager's client-initiated close paths (idle, manual, force)
// settle synchronously with the socket's handlers detached, so a replacement
// opened during the asynchronous close window can no longer be clobbered by
// the dying socket's late close event — the same orphaned-socket class the
// entity manager fixed, where each leak delivered every event once more.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ChatWebsocketManager } from './realtime-websocket-manager'

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
  onclose: ((event: { wasClean: boolean }) => void) | null = null
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

  open() {
    this.readyState = MockWebSocket.OPEN
    this.onopen?.()
  }

  finishClose(wasClean = false) {
    this.readyState = MockWebSocket.CLOSED
    this.onclose?.({ wasClean })
  }

  deliver(payload: unknown) {
    this.onmessage?.({ data: JSON.stringify(payload) })
  }
}

// openSocket awaits the chat key before constructing the socket.
async function flush() {
  await Promise.resolve()
  await Promise.resolve()
  await Promise.resolve()
}

describe('ChatWebsocketManager close races', () => {
  let manager: ChatWebsocketManager

  beforeEach(() => {
    vi.useFakeTimers()
    MockWebSocket.instances = []
    vi.stubGlobal('WebSocket', MockWebSocket)
    manager = new ChatWebsocketManager({ baseUrl: 'http://localhost' })
  })

  afterEach(() => {
    manager.dispose()
    vi.unstubAllGlobals()
    vi.useRealTimers()
  })

  it('a resubscribe after the idle close cannot be orphaned by the old socket', async () => {
    const unsubscribe = manager.subscribe('c1', {
      chatKey: 'k1',
      onMessage: () => {},
    })
    await flush()
    const [first] = MockWebSocket.instances
    first.open()

    unsubscribe()
    vi.advanceTimersByTime(10_000)
    expect(first.closeCalled).toBe(true)
    expect(first.onclose).toBeNull()
    expect(first.onmessage).toBeNull()

    // A new subscriber arrives while the old socket is still CLOSING.
    const received: unknown[] = []
    manager.subscribe('c1', {
      chatKey: 'k1',
      onMessage: (e) => received.push(e.payload.id),
    })
    await flush()
    expect(MockWebSocket.instances).toHaveLength(2)
    const second = MockWebSocket.instances[1]
    second.open()

    // The old socket's close completes late; detached handlers mean it cannot
    // touch the replacement or schedule a reconnect on top of it.
    first.finishClose()
    await vi.runAllTimersAsync()

    expect(MockWebSocket.instances).toHaveLength(2)
    second.deliver({ id: 'm1', body: 'one delivery expected' })
    expect(received).toEqual(['m1'])
  })

  it('forceReconnect cycles to exactly one replacement', async () => {
    manager.subscribe('c2', { chatKey: 'k2', onMessage: () => {} })
    await flush()
    const [first] = MockWebSocket.instances
    first.open()

    manager.forceReconnect('c2')
    await flush()
    expect(first.closeCalled).toBe(true)
    expect(first.onclose).toBeNull()
    expect(MockWebSocket.instances).toHaveLength(2)

    MockWebSocket.instances[1].open()
    first.finishClose()
    await vi.runAllTimersAsync()
    expect(MockWebSocket.instances).toHaveLength(2)
  })

  it('a server-initiated unclean close still reconnects', async () => {
    const statuses: string[] = []
    manager.subscribe('c3', {
      chatKey: 'k3',
      onStatusChange: (s) => statuses.push(s.status),
    })
    await flush()
    const [first] = MockWebSocket.instances
    first.open()

    first.finishClose(false)
    expect(statuses.at(-1)).toBe('error')
    await vi.advanceTimersByTimeAsync(0)
    await flush()

    expect(MockWebSocket.instances).toHaveLength(2)
  })
})
