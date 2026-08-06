// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: Apache-2.0

// Entity WebSocket manager - one connection per entity key, shared by every
// subscriber of that key.
//
// This is deliberately not the same thing as ChatWebsocketManager in
// realtime-websocket-manager.ts. That one carries connection status snapshots
// and retry telemetry for the chat and game apps. This one is the small
// fan-out singleton the entity apps need: subscribe by key, get parsed events,
// reconnect on drop, close when the last subscriber leaves.
//
// crm, projects, repos, wikis, feeds and forums each grew a private copy of
// this class. They are 0.92-1.00 identical to each other, so a fix to one has
// never reached the rest. Adopting this module is what stops that.

import { useAuthStore } from '../stores/auth-store'

const RECONNECT_DELAY = 3000

/**
 * A server event for a subscribed entity. `type` is the only field every
 * event carries; the rest depend on the event and are read by the app's own
 * handler.
 */
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
  return `${protocol}//${window.location.host}/_/websocket?key=${key}${tokenParam}`
}

class EntityWebsocketManager {
  private connections = new Map<string, WebSocket>()
  private reconnectTimers = new Map<string, ReturnType<typeof setTimeout>>()
  private subscribers = new Map<string, Set<EntityWebsocketListener>>()
  private connectionAttempts = new Map<string, boolean>()

  /** Subscribe to `key`. Returns the unsubscribe function. */
  subscribe(key: string, callback: EntityWebsocketListener): () => void {
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

  private scheduleReconnect(key: string) {
    if (!this.subscribers.get(key)?.size) return
    const t = setTimeout(() => this.connect(key), RECONNECT_DELAY)
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
      // Detach before closing. `close()` is asynchronous, so a subscriber that
      // arrives before the close event lands opens a replacement connection —
      // and the old socket's onclose would then delete that live connection
      // from the map and schedule a second one on top of it, leaving an orphan
      // socket delivering every event twice.
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
