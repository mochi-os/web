// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: Apache-2.0

// Client-initiated closes (idle, manual, force) settle synchronously with the
// handlers detached, so a replacement opened during the close window is not
// clobbered by the dying socket's late close event.

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
    manager = new ChatWebsocketManager({ base: 'http://localhost' })
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

  it('a server-initiated clean close reconnects while subscribers remain', async () => {
    // A restart or deploy closes with code 1000/1001. That close reaches
    // handleClose only when the server sent it (client closes detach the
    // handler first), and the subscriber still wants the stream.
    manager.subscribe('c4', { chatKey: 'k4', onMessage: () => {} })
    await flush()
    const [first] = MockWebSocket.instances
    first.open()

    first.finishClose(true)
    await vi.advanceTimersByTimeAsync(0)
    await flush()

    expect(MockWebSocket.instances).toHaveLength(2)
  })

  it('a server-initiated clean close with no subscribers left stays closed', async () => {
    const unsubscribe = manager.subscribe('c5', { chatKey: 'k5', onMessage: () => {} })
    await flush()
    const [first] = MockWebSocket.instances
    first.open()
    // Detach the listener without the client-side close, so the server's
    // clean close is the only close this entry sees.
    unsubscribe()
    first.finishClose(true)
    await vi.advanceTimersByTimeAsync(0)
    await flush()

    expect(MockWebSocket.instances).toHaveLength(1)
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

// The socket URL carries the session JWT in its query string, because a browser
// cannot set a header on a WebSocket handshake, so it needs the same
// same-origin gate api-client.ts applies to the Authorization header.
describe('ChatWebsocketManager token scoping', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    MockWebSocket.instances = []
    vi.stubGlobal('WebSocket', MockWebSocket)
  })
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.useRealTimers()
  })

  async function connect(base: string) {
    const manager = new ChatWebsocketManager({
      base,
      token: () => 'Bearer secret-jwt',
    })
    manager.subscribe('c1', { chatKey: 'k1', onMessage: () => {} })
    await vi.advanceTimersByTimeAsync(0)
    const url = MockWebSocket.instances[0]?.url ?? ''
    manager.dispose()
    return url
  }

  it('defaults to the socket route core serves', async () => {
    // Every app used to carry VITE_WEBSOCKET_URL=./_/ because the default
    // derived /websocket, which core does not serve.
    const manager = new ChatWebsocketManager({ token: () => 'Bearer secret-jwt' })
    manager.subscribe('c1', { chatKey: 'k1', onMessage: () => {} })
    await vi.advanceTimersByTimeAsync(0)
    const url = new URL(MockWebSocket.instances[0]?.url ?? 'ws://unset/')
    manager.dispose()
    expect(url.pathname).toBe('/_/websocket')
    expect(url.searchParams.get('token')).toBe('secret-jwt')
  })

  it('sends the token to this origin', async () => {
    // Companion to the refusals below: without it, "no token in the URL"
    // would pass just as well against a manager that never connects.
    const url = await connect(window.location.origin)
    expect(url).toContain('key=k1')
    expect(url).toContain('token=secret-jwt')
  })

  it('withholds the token from another origin', async () => {
    const url = await connect('https://evil.example')
    expect(url).toContain('key=k1')
    expect(url).not.toContain('secret-jwt')
    expect(url).not.toContain('token=')
  })

  it('withholds the token from another port on this host', async () => {
    // A port is part of an origin, and this is the case a host-only check
    // would wave through.
    const url = await connect(`${window.location.protocol}//${window.location.hostname}:8443`)
    expect(url).not.toContain('secret-jwt')
  })
})
