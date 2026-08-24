// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: Apache-2.0

// One connection per entity key, shared by every subscriber of that key. Not
// ChatWebsocketManager in realtime-websocket-manager.ts, which carries
// connection status snapshots and retry telemetry for chat and games.

import { useAuthStore } from '../stores/auth-store'

// Reconnect backoff, doubling to a 30s ceiling with jitter: a flat retry has
// every tab hammering the server in lockstep for as long as it is down.
const RECONNECT_DELAY_MINIMUM = 1000
const RECONNECT_DELAY_MAXIMUM = 30000

export interface EntityWebsocketEvent {
  type: string
  object?: string
  id?: string
  source?: string
  target?: string
  [key: string]: unknown
}

export type EntityWebsocketListener = (event: EntityWebsocketEvent) => void

function getWebSocketUrl(key: string): string {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
  const raw = useAuthStore.getState().token
  const token = raw?.startsWith('Bearer ') ? raw.slice(7) : raw
  const tokenParam = token ? `&token=${encodeURIComponent(token)}` : ''
  // key is a route parameter: a '#' in it truncates the URL and drops the
  // token entirely, so the socket would connect unauthenticated.
  return `${protocol}//${window.location.host}/_/websocket?key=${encodeURIComponent(key)}${tokenParam}`
}

class EntityWebsocketManager {
  private connections = new Map<string, WebSocket>()
  private reconnectTimers = new Map<string, ReturnType<typeof setTimeout>>()
  private subscribers = new Map<string, Set<EntityWebsocketListener>>()
  private connectionAttempts = new Map<string, boolean>()
  private reconnectFailures = new Map<string, number>()
  // Keys whose reconnect was deferred because the browser reported offline.
  private pendingReconnect = new Set<string>()
  private onlineListener = false

  /** Subscribe to `key`. Returns the unsubscribe function. */
  subscribe(key: string, callback: EntityWebsocketListener): () => void {
    this.watchOnline()
    if (!this.subscribers.has(key)) {
      this.subscribers.set(key, new Set())
    }
    this.subscribers.get(key)!.add(callback)
    this.ensureConnection(key)

    return () => {
      const subs = this.subscribers.get(key)
      if (subs) {
        subs.delete(callback)
        if (subs.size === 0) {
          this.subscribers.delete(key)
          this.closeConnection(key)
        }
      }
    }
  }

  private ensureConnection(key: string) {
    const existing = this.connections.get(key)
    if (
      existing &&
      (existing.readyState === WebSocket.OPEN ||
        existing.readyState === WebSocket.CONNECTING)
    ) {
      return
    }
    if (this.connectionAttempts.get(key)) return
    this.connect(key)
  }

  private connect(key: string) {
    const timer = this.reconnectTimers.get(key)
    if (timer) {
      clearTimeout(timer)
      this.reconnectTimers.delete(key)
    }
    if (!this.subscribers.has(key) || this.subscribers.get(key)!.size === 0) {
      return
    }

    this.connectionAttempts.set(key, true)

    try {
      const ws = new WebSocket(getWebSocketUrl(key))
      this.connections.set(key, ws)

      ws.onopen = () => {
        this.connectionAttempts.set(key, false)
        // A connection that lasted is not a failure: reset so the next drop
        // retries promptly instead of inheriting an old backoff.
        this.reconnectFailures.delete(key)
      }

      ws.onmessage = (event) => {
        try {
          const data: EntityWebsocketEvent = JSON.parse(event.data)
          this.subscribers.get(key)?.forEach((callback) => callback(data))
        } catch {
          // Ignore parse errors
        }
      }

      ws.onclose = () => {
        // Only the socket that owns the map entry may act here. A socket the
        // server closed keeps its handlers while CLOSING, and a subscriber
        // arriving in that window opens a replacement — which this handler
        // would otherwise delete and double up with a reconnect.
        if (this.connections.get(key) !== ws) return
        this.connectionAttempts.set(key, false)
        this.connections.delete(key)
        this.scheduleReconnect(key)
      }

      ws.onerror = () => {
        if (this.connections.get(key) !== ws) return
        this.connectionAttempts.set(key, false)
      }
    } catch {
      this.connectionAttempts.set(key, false)
      this.scheduleReconnect(key)
    }
  }

  // Reconnect everything that was waiting the moment the network returns,
  // rather than leaving each key to discover it on its own timer.
  private watchOnline() {
    if (this.onlineListener || typeof window === 'undefined') return
    this.onlineListener = true
    window.addEventListener('online', () => {
      const waiting = [...this.pendingReconnect]
      this.pendingReconnect.clear()
      for (const key of waiting) {
        // Coming back online is not a failure, so reconnect immediately.
        this.reconnectFailures.delete(key)
        if (this.subscribers.get(key)?.size) this.connect(key)
      }
    })
  }

  private scheduleReconnect(key: string) {
    if (!this.subscribers.get(key)?.size) return
    // Offline: don't burn retries against a network that cannot answer. The
    // online listener reconnects every waiting key the moment it returns,
    // which is faster than any timer would have been anyway.
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      this.pendingReconnect.add(key)
      return
    }
    const failures = this.reconnectFailures.get(key) ?? 0
    this.reconnectFailures.set(key, failures + 1)
    const base = Math.min(RECONNECT_DELAY_MINIMUM * 2 ** failures, RECONNECT_DELAY_MAXIMUM)
    // Full jitter: without it every tab that dropped together retries
    // together, and the reconnect storm is what finished off the server.
    const delay = Math.round(base / 2 + Math.random() * (base / 2))
    const t = setTimeout(() => this.connect(key), delay)
    this.reconnectTimers.set(key, t)
  }

  private closeConnection(key: string) {
    const timer = this.reconnectTimers.get(key)
    if (timer) {
      clearTimeout(timer)
      this.reconnectTimers.delete(key)
    }
    const ws = this.connections.get(key)
    if (ws) {
      // Detach before closing: close() is asynchronous, and a replacement
      // opened in that window would be deleted from the map by this socket's
      // onclose, leaving an orphan that delivers every event twice.
      ws.onopen = null
      ws.onmessage = null
      ws.onclose = null
      ws.onerror = null
      ws.close()
      this.connections.delete(key)
    }
    this.connectionAttempts.delete(key)
  }
}

export const entityWebsocketManager = new EntityWebsocketManager()
