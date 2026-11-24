// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: Apache-2.0

// The close/reopen races: close() completes asynchronously, so a replacement
// opened in the CLOSING window must survive the dying socket's onclose, which
// otherwise leaves an orphan fanning every event out twice.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  entityWebsocketManager,
  type EntityWebsocketEvent,
} from './entity-websocket-manager'
import { useAuthStore } from '../stores/auth-store'

class MockWebSocket {
  static CONNECTING = 0
  static OPEN = 1
  static CLOSING = 2
  static CLOSED = 3
  static instances: MockWebSocket[] = []

  url: string
  protocols?: string | string[]
  readyState = MockWebSocket.CONNECTING
  onopen: (() => void) | null = null
  onmessage: ((event: { data: string }) => void) | null = null
  onclose: (() => void) | null = null
  onerror: (() => void) | null = null
  closeCalled = false

  constructor(url: string, protocols?: string | string[]) {
    this.url = url
    this.protocols = protocols
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

// jsdom leaves document.hidden read-only, so the visibility cases redefine it.
function setHidden(hidden: boolean) {
  Object.defineProperty(document, 'hidden', {
    value: hidden,
    configurable: true,
  })
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
    Object.defineProperty(navigator, 'onLine', {
      value: false,
      configurable: true,
    })

    const before = MockWebSocket.instances.length
    MockWebSocket.instances[MockWebSocket.instances.length - 1].onclose?.()
    vi.advanceTimersByTime(120000)
    expect(MockWebSocket.instances.length).toBe(before)

    Object.defineProperty(navigator, 'onLine', {
      value: true,
      configurable: true,
    })
    window.dispatchEvent(new Event('online'))
    expect(MockWebSocket.instances.length).toBeGreaterThan(before)

    if (original) Object.defineProperty(navigator, 'onLine', original)
    stop()
  })

  // A hidden tab throttles setTimeout to a minute or worse, so a socket that
  // dropped in the background is still down when the user comes back, and the
  // pending retry is whatever the browser stretched it to.
  it('reconnects when the tab is shown rather than waiting out a throttled timer', () => {
    const stop = entityWebsocketManager.subscribe('wake', () => {})
    MockWebSocket.instances[MockWebSocket.instances.length - 1].open()
    vi.spyOn(Math, 'random').mockReturnValue(1)

    // Climb the backoff to its ceiling, so the pending retry is far out.
    setHidden(true)
    for (let i = 0; i < 4; i++) {
      MockWebSocket.instances[MockWebSocket.instances.length - 1].onclose?.()
      vi.advanceTimersByTime(31000)
    }
    const before = MockWebSocket.instances.length
    MockWebSocket.instances[before - 1].onclose?.()

    // Nothing yet: the next retry is tens of seconds away.
    vi.advanceTimersByTime(1000)
    expect(MockWebSocket.instances.length).toBe(before)

    setHidden(false)
    document.dispatchEvent(new Event('visibilitychange'))

    expect(MockWebSocket.instances.length).toBeGreaterThan(before)
    stop()
  })

  it('opens no second socket when the tab is shown with the connection live', () => {
    const stop = entityWebsocketManager.subscribe('wakeLive', () => {})
    MockWebSocket.instances[MockWebSocket.instances.length - 1].open()

    const before = MockWebSocket.instances.length
    setHidden(false)
    document.dispatchEvent(new Event('visibilitychange'))
    vi.runAllTimers()

    expect(MockWebSocket.instances.length).toBe(before)
    stop()
  })

  // Showing the tab is not evidence the network is back, and retrying into a
  // dead network is what the offline guard exists to prevent.
  it('does not reconnect on show while the browser reports offline', () => {
    const stop = entityWebsocketManager.subscribe('wakeOffline', () => {})
    const original = Object.getOwnPropertyDescriptor(navigator, 'onLine')
    Object.defineProperty(navigator, 'onLine', {
      value: false,
      configurable: true,
    })

    const before = MockWebSocket.instances.length
    MockWebSocket.instances[before - 1].onclose?.()
    setHidden(false)
    document.dispatchEvent(new Event('visibilitychange'))

    expect(MockWebSocket.instances.length).toBe(before)

    if (original) Object.defineProperty(navigator, 'onLine', original)
    stop()
  })

  // What was sent while the socket was down never arrived, so a reconnect is
  // told to the subscribers; the first open is not, as nothing was missed.
  it('tells the subscribers of a reconnect, not of the first open', () => {
    const events: EntityWebsocketEvent[] = []
    const stop = entityWebsocketManager.subscribe('reopen', (event) =>
      events.push(event)
    )
    const first = socketsFor('reopen')[0]
    first.open()
    expect(events).toEqual([])
    first.finishClose()
    vi.advanceTimersByTime(60000)
    const sockets = socketsFor('reopen')
    sockets[sockets.length - 1].open()
    expect(events).toEqual([{ type: 'socket/reopen' }])
    stop()
  })

  // A subscriber that fetched what the frames change before its socket was
  // there missed whatever was sent meanwhile, on the first open as on a
  // reconnect, so one that asks hears of every open.
  it('tells a subscriber that asks of every open, the first included', () => {
    const opens: string[] = []
    const events: EntityWebsocketEvent[] = []
    const stop = entityWebsocketManager.subscribe(
      'opens',
      (event) => events.push(event),
      { open: () => opens.push('open') }
    )
    const first = socketsFor('opens')[0]
    expect(opens).toEqual([])
    first.open()
    expect(opens).toEqual(['open'])
    first.finishClose()
    vi.advanceTimersByTime(60000)
    const sockets = socketsFor('opens')
    sockets[sockets.length - 1].open()
    expect(opens).toEqual(['open', 'open'])
    // The reconnect is told to every subscriber as before.
    expect(events).toEqual([{ type: 'socket/reopen' }])
    stop()
  })

  it('tells one that subscribes to a socket already open at once, and no other', async () => {
    const opens: string[] = []
    const stop = entityWebsocketManager.subscribe('openLive', () => {}, {
      open: () => opens.push('first'),
    })
    socketsFor('openLive')[0].open()
    const later = entityWebsocketManager.subscribe('openLive', () => {}, {
      open: () => opens.push('later'),
    })
    expect(opens).toEqual(['first'])
    await Promise.resolve()
    expect(opens).toEqual(['first', 'later'])
    later()
    stop()
  })

  it('tells one that has left of nothing', async () => {
    const opens: string[] = []
    const stay = entityWebsocketManager.subscribe('openLeft', () => {})
    const gone = entityWebsocketManager.subscribe('openLeft', () => {}, {
      open: () => opens.push('gone'),
    })
    gone()
    socketsFor('openLeft')[0].open()
    // Subscribed to an open socket and gone before the microtask runs.
    const brief = entityWebsocketManager.subscribe('openLeft', () => {}, {
      open: () => opens.push('brief'),
    })
    brief()
    await Promise.resolve()
    expect(opens).toEqual([])
    stay()
  })

  it('starts afresh for subscribers who come after the last one left', () => {
    const before = entityWebsocketManager.subscribe('fresh', () => {})
    socketsFor('fresh')[0].open()
    before()
    const events: EntityWebsocketEvent[] = []
    const stop = entityWebsocketManager.subscribe('fresh', (event) =>
      events.push(event)
    )
    const sockets = socketsFor('fresh')
    sockets[sockets.length - 1].open()
    expect(events).toEqual([])
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
    entityWebsocketManager.subscribe('kC', (event) =>
      received.push(`a:${event.type}`)
    )
    const [first] = socketsFor('kC')
    first.open()
    first.readyState = MockWebSocket.CLOSING

    entityWebsocketManager.subscribe('kC', (event) =>
      received.push(`b:${event.type}`)
    )
    expect(socketsFor('kC')).toHaveLength(2)
    const second = socketsFor('kC')[1]
    second.open()

    // The old socket's onclose fires late. The identity guard must keep it
    // from deleting the live replacement and spawning a third connection.
    first.finishClose()
    vi.runAllTimers()

    expect(socketsFor('kC')).toHaveLength(2)
    second.deliver({ type: 'ping' })
    // The replacement opening is a reconnect, so both are told of it first.
    expect(received).toEqual([
      'a:socket/reopen',
      'b:socket/reopen',
      'a:ping',
      'b:ping',
    ])
  })

  // The token used to travel in the handshake URL, where it lands in every
  // access log and in any URL a viewer copies.
  describe('token presentation', () => {
    beforeEach(() => {
      useAuthStore.setState({ token: 'Bearer secret-token' })
      vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(true)
    })

    afterEach(() => {
      useAuthStore.setState({ token: '' })
    })

    it('offers the token as a subprotocol and leaves the URL clean', () => {
      entityWebsocketManager.subscribe('kToken', () => {})
      const [socket] = socketsFor('kToken')
      expect(socket.protocols).toEqual(['mochi.token.secret-token'])
      expect(socket.url).not.toContain('token=')
    })

    it('keeps the token out of the URL when a handshake is refused', () => {
      entityWebsocketManager.subscribe('kRefused', () => {})
      const [first] = socketsFor('kRefused')
      // Closed without ever opening: the server refused the handshake, as it
      // does while it restarts or for a socket over the user's limit.
      first.finishClose()
      vi.runAllTimers()

      const sockets = socketsFor('kRefused')
      expect(sockets.length).toBeGreaterThan(1)
      const retry = sockets[sockets.length - 1]
      expect(retry.protocols).toEqual(['mochi.token.secret-token'])
      expect(retry.url).not.toContain('token=')
    })

    it('keeps the token out of the URL when a live socket drops', () => {
      entityWebsocketManager.subscribe('kDrop', () => {})
      const [first] = socketsFor('kDrop')
      first.open()
      first.finishClose()
      vi.runAllTimers()

      const sockets = socketsFor('kDrop')
      const retry = sockets[sockets.length - 1]
      expect(retry.protocols).toEqual(['mochi.token.secret-token'])
      expect(retry.url).not.toContain('token=')
    })
  })
})
