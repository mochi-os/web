// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: Apache-2.0

// WebSocket manager — generic, works with any app

const devConsole = globalThis.console

export type WebsocketConnectionStatus =
  | 'idle'
  | 'connecting'
  | 'ready'
  | 'closing'
  | 'error'

export interface WebsocketConnectionSnapshot {
  chat: string
  status: WebsocketConnectionStatus
  retries: number
  lastError?: string
}

export interface ChatWebsocketMessagePayload {
  id?: string
  body?: string
  member?: string
  name?: string
  created?: number
  attachments?: unknown[]
  [key: string]: unknown
}

export interface ChatWebsocketEvent {
  chat: string
  payload: ChatWebsocketMessagePayload
}

export type ChatWebsocketListener = (event: ChatWebsocketEvent) => void
export type ChatWebsocketStatusListener = (
  snapshot: WebsocketConnectionSnapshot
) => void

export interface ChatWebsocketManagerOptions {
  /** Base URL the socket path is resolved against. Defaults to core's /_/ route on this origin. */
  base?: string
  /** Milliseconds a connection with no listeners stays open before it is closed. */
  idle?: number
  /** Reconnect backoff in milliseconds: the first delay, and the ceiling it grows to. */
  delay?: { base?: number; maximum?: number }
  /** Reconnect attempts before a connection is given up as failed. */
  retries?: number
  key?: (chat: string) => Promise<string | undefined>
  token?: () => string | undefined
}

interface ConnectionEntry {
  chat: string
  key?: string
  status: WebsocketConnectionStatus
  retries: number
  socket?: WebSocket
  reconnectTimer?: ReturnType<typeof setTimeout>
  idleTimer?: ReturnType<typeof setTimeout>
  connectPromise?: Promise<void>
  keyPromise?: Promise<string | undefined>
  pendingReconnect?: boolean
  lastError?: string
  messageListeners: Set<ChatWebsocketListener>
  statusListeners: Set<ChatWebsocketStatusListener>
}

const DEFAULT_BASE_DELAY = 1000
const DEFAULT_MAX_DELAY = 30_000
const DEFAULT_MAX_RETRIES = 10
const DEFAULT_IDLE_DISCONNECT = 10_000

// Core serves the socket at /_/websocket, so the default base is /_/ on this
// origin; an app's VITE_WEBSOCKET_URL is an override, not a requirement.
const defaultBase = (): string =>
  typeof window !== 'undefined'
    ? new URL('/_/', window.location.origin).href
    : 'http://localhost/_/'

const toWssUrl = (rawUrl: string): string => {
  if (typeof window === 'undefined') {
    throw new Error('window is not defined')
  }
  const origin = window.location.origin
  const url = new URL(rawUrl || defaultBase(), origin)
  if (url.protocol === 'http:') url.protocol = 'ws:'
  else if (url.protocol === 'https:') url.protocol = 'wss:'
  url.pathname = url.pathname.replace(/\/+$/, '') + '/websocket'
  return url.toString()
}

export class ChatWebsocketManager {
  private readonly base: string
  private readonly idle: number
  private readonly delay: { base: number; maximum: number }
  private readonly retries: number
  private readonly key?: (chat: string) => Promise<string | undefined>
  private readonly token?: () => string | undefined
  private readonly connections = new Map<string, ConnectionEntry>()
  private disposed = false
  private online: boolean

  constructor(options: ChatWebsocketManagerOptions = {}) {
    this.base = options.base ?? import.meta.env.VITE_WEBSOCKET_URL ?? defaultBase()
    this.idle = options.idle ?? DEFAULT_IDLE_DISCONNECT
    this.delay = {
      base: options.delay?.base ?? DEFAULT_BASE_DELAY,
      maximum: options.delay?.maximum ?? DEFAULT_MAX_DELAY,
    }
    this.retries = options.retries ?? DEFAULT_MAX_RETRIES
    this.key = options.key
    this.token = options.token
    this.online = typeof navigator === 'undefined' ? true : navigator.onLine

    if (typeof window !== 'undefined') {
      window.addEventListener('online', this.handleOnline)
      window.addEventListener('offline', this.handleOffline)
    }
  }

  subscribe(
    chat: string,
    options: {
      chatKey?: string
      onMessage?: ChatWebsocketListener
      onStatusChange?: ChatWebsocketStatusListener
    }
  ): () => void {
    const entry = this.getOrCreateEntry(chat)

    if (options.chatKey && options.chatKey !== entry.key) {
      entry.key = options.chatKey
    }

    if (options.onMessage) {
      entry.messageListeners.add(options.onMessage)
    }

    if (options.onStatusChange) {
      entry.statusListeners.add(options.onStatusChange)
    }

    if (options.onStatusChange) {
      options.onStatusChange(this.snapshot(entry))
    }

    this.clearIdleTimer(entry)

    if (this.hasListeners(entry)) {
      if (this.online) {
        void this.ensureSocket(entry)
      } else {
        this.updateStatus(entry, 'error', 'offline')
      }
    }

    return () => {
      if (options.onMessage) {
        entry.messageListeners.delete(options.onMessage)
      }
      if (options.onStatusChange) {
        entry.statusListeners.delete(options.onStatusChange)
      }
      if (!this.hasListeners(entry)) {
        this.scheduleIdleClose(entry)
      }
    }
  }

  forceReconnect(chat: string) {
    const entry = this.connections.get(chat)
    if (!entry) return
    entry.retries = 0
    entry.pendingReconnect = false
    this.clearReconnectTimer(entry)
    this.closeSocket(entry, 'force')
  }

  dispose() {
    if (this.disposed) return
    this.disposed = true
    this.connections.forEach((entry) => {
      this.clearReconnectTimer(entry)
      this.clearIdleTimer(entry)
      this.closeSocket(entry, 'manual')
    })
    this.connections.clear()
    if (typeof window !== 'undefined') {
      window.removeEventListener('online', this.handleOnline)
      window.removeEventListener('offline', this.handleOffline)
    }
  }

  /** Whether base resolves to the page's own origin. */
  private sameOrigin(): boolean {
    if (typeof window === 'undefined') return false
    try {
      return (
        new URL(this.base || window.location.origin, window.location.origin)
          .origin === window.location.origin
      )
    } catch {
      return false
    }
  }

  private getOrCreateEntry(chat: string): ConnectionEntry {
    const existing = this.connections.get(chat)
    if (existing) {
      return existing
    }

    const entry: ConnectionEntry = {
      chat,
      status: 'idle',
      retries: 0,
      messageListeners: new Set(),
      statusListeners: new Set(),
    }

    this.connections.set(chat, entry)
    return entry
  }

  private hasListeners(entry: ConnectionEntry): boolean {
    return entry.messageListeners.size > 0 || entry.statusListeners.size > 0
  }

  private snapshot(entry: ConnectionEntry): WebsocketConnectionSnapshot {
    return {
      chat: entry.chat,
      status: entry.status,
      retries: entry.retries,
      lastError: entry.lastError,
    }
  }

  private async ensureSocket(entry: ConnectionEntry): Promise<void> {
    if (this.disposed || !this.hasListeners(entry)) {
      return
    }

    if (entry.socket || entry.connectPromise) {
      return entry.connectPromise
    }

    entry.connectPromise = this.openSocket(entry)
    try {
      await entry.connectPromise
    } finally {
      entry.connectPromise = undefined
    }
  }

  private async openSocket(entry: ConnectionEntry): Promise<void> {
    const chatKey = await this.resolveChatKey(entry)
    if (!chatKey) {
      this.updateStatus(entry, 'error', 'missing-key')
      return
    }

    // dispose() as well as the listener count: dispose clears the map but not
    // each entry's listener sets, so a call already past ensureSocket's guard
    // when dispose ran would otherwise open a socket for an entry nothing
    // holds a reference to, and nothing would ever close it.
    if (this.disposed || !this.hasListeners(entry)) {
      return
    }

    const websocketUrl = toWssUrl(this.base)
    const socketUrl = new URL(websocketUrl)
    socketUrl.searchParams.set('key', chatKey)

    // Same-origin only, as api-client.ts gates the Authorization header:
    // base need not be this origin and the token travels in the query
    // string. Tested
    // against the http(s) base - wss://host never equals https://host.
    const token = this.sameOrigin() ? this.token?.() : undefined
    if (token) {
      const rawToken = token.startsWith('Bearer ') ? token.slice(7) : token
      socketUrl.searchParams.set('token', rawToken)
    }

    try {
      const socket = new WebSocket(socketUrl.toString())
      entry.socket = socket
      this.updateStatus(entry, 'connecting')
      socket.onopen = () => {
        entry.retries = 0
        entry.pendingReconnect = false
        this.updateStatus(entry, 'ready')
      }
      socket.onmessage = (event) => {
        this.handleMessage(entry, event)
      }
      socket.onerror = (event) => {
        if (import.meta.env.DEV) {
          devConsole?.warn?.(`[WebSocket] ${entry.chat} error`, event)
        }
        this.updateStatus(entry, 'error', 'socket-error')
      }
      socket.onclose = (event) => {
        this.handleClose(entry, socket, event)
      }
    } catch (error) {
      if (import.meta.env.DEV) {
        devConsole?.error?.(
          `[WebSocket] Failed to connect for ${entry.chat}`,
          error
        )
      }
      this.updateStatus(entry, 'error', 'connect-failed')
      this.scheduleReconnect(entry)
    }
  }

  private async resolveChatKey(
    entry: ConnectionEntry
  ): Promise<string | undefined> {
    if (entry.key) {
      return entry.key
    }

    if (!this.key) {
      return undefined
    }

    if (!entry.keyPromise) {
      entry.keyPromise = this.key(entry.chat).finally(() => {
        entry.keyPromise = undefined
      })
    }

    entry.key = await entry.keyPromise
    return entry.key
  }

  private handleMessage(entry: ConnectionEntry, event: MessageEvent) {
    const deliver = (payload: ChatWebsocketMessagePayload | null) => {
      if (!payload) {
        return
      }

      const chatEvent: ChatWebsocketEvent = {
        chat: entry.chat,
        payload,
      }

      entry.messageListeners.forEach((listener) => {
        try {
          listener(chatEvent)
        } catch (error) {
          if (import.meta.env.DEV) {
            devConsole?.error?.(
              `[WebSocket] listener error for ${entry.chat}`,
              error
            )
          }
        }
      })
    }

    if (typeof event.data === 'string') {
      deliver(this.safeParse(event.data))
      return
    }

    if (
      typeof Blob !== 'undefined' &&
      event.data instanceof Blob &&
      typeof event.data.text === 'function'
    ) {
      void event.data
        .text()
        .then((text) => deliver(this.safeParse(text)))
        .catch((error) => {
          if (import.meta.env.DEV) {
            devConsole?.error?.(
              `[WebSocket] Failed to parse blob message for ${entry.chat}`,
              error
            )
          }
        })
      return
    }

    // Attempt to treat non-string payloads as already parsed
    if (event.data && typeof event.data === 'object') {
      deliver(event.data as ChatWebsocketMessagePayload)
    }
  }

  private safeParse(raw: string): ChatWebsocketMessagePayload | null {
    try {
      const parsed = JSON.parse(raw)
      if (parsed && typeof parsed === 'object') {
        return parsed as ChatWebsocketMessagePayload
      }
    } catch (error) {
      if (import.meta.env.DEV) {
        devConsole?.error?.('[WebSocket] Failed to parse payload', raw, error)
      }
    }
    return null
  }

  private handleClose(
    entry: ConnectionEntry,
    socket: WebSocket,
    event: CloseEvent
  ) {
    // Act only for the socket that still owns the entry: a stale close event
    // must not clear a replacement's reference or reconnect on top of it.
    if (entry.socket !== socket) {
      return
    }
    entry.socket = undefined

    if (event.wasClean) {
      this.updateStatus(entry, 'idle')
      // A clean close that reaches here came from the server - a restart, a
      // deploy - since client-initiated closes detach onclose first. With
      // subscribers still listening it is a reconnect, not a terminal state.
      if (this.hasListeners(entry)) this.scheduleReconnect(entry)
      return
    }

    this.updateStatus(entry, 'error', 'disconnected')
    this.scheduleReconnect(entry)
  }

  private scheduleReconnect(entry: ConnectionEntry) {
    if (!this.hasListeners(entry)) {
      return
    }

    if (entry.retries >= this.retries) {
      entry.lastError = 'max-retries'
      this.updateStatus(entry, 'error', 'max-retries')
      return
    }

    if (entry.reconnectTimer) {
      return
    }

    const attempt = entry.retries + 1
    const rawDelay = Math.min(
      this.delay.maximum,
      this.delay.base * 2 ** (attempt - 1)
    )
    const jitterFactor = 0.85 + Math.random() * 0.3
    const delay = attempt === 1 ? 0 : Math.round(rawDelay * jitterFactor)

    entry.reconnectTimer = setTimeout(() => {
      this.clearReconnectTimer(entry)
      if (!this.hasListeners(entry)) {
        return
      }
      if (!this.online) {
        entry.pendingReconnect = true
        return
      }
      entry.retries = attempt
      this.updateStatus(entry, 'connecting')
      void this.ensureSocket(entry)
    }, delay)
  }

  private closeSocket(
    entry: ConnectionEntry,
    reason: 'idle' | 'manual' | 'force'
  ) {
    if (!entry.socket) {
      if (reason === 'force' && this.online && this.hasListeners(entry)) {
        void this.ensureSocket(entry)
      }
      return
    }

    // Detach before closing and settle the terminal state synchronously:
    // close() is asynchronous, and a replacement opened in that window would be
    // orphaned by the dying socket's late close event.
    const socket = entry.socket
    socket.onopen = null
    socket.onmessage = null
    socket.onerror = null
    socket.onclose = null
    this.updateStatus(entry, 'closing')
    try {
      socket.close()
    } catch (error) {
      if (import.meta.env.DEV) {
        devConsole?.error?.(
          `[WebSocket] Failed to close socket for ${entry.chat}`,
          error
        )
      }
    } finally {
      entry.socket = undefined
    }

    if (reason === 'force') {
      this.updateStatus(entry, 'connecting')
      if (this.online) {
        void this.ensureSocket(entry)
      } else {
        entry.pendingReconnect = true
        this.updateStatus(entry, 'error', 'offline')
      }
      return
    }

    this.updateStatus(entry, 'idle')
  }

  private scheduleIdleClose(entry: ConnectionEntry) {
    if (entry.idleTimer || !entry.socket) {
      return
    }
    entry.idleTimer = setTimeout(() => {
      this.clearIdleTimer(entry)
      if (this.hasListeners(entry)) {
        return
      }
      this.closeSocket(entry, 'idle')
    }, this.idle)
  }

  private clearReconnectTimer(entry: ConnectionEntry) {
    if (entry.reconnectTimer) {
      clearTimeout(entry.reconnectTimer)
      entry.reconnectTimer = undefined
    }
  }

  private clearIdleTimer(entry: ConnectionEntry) {
    if (entry.idleTimer) {
      clearTimeout(entry.idleTimer)
      entry.idleTimer = undefined
    }
  }

  private updateStatus(
    entry: ConnectionEntry,
    status: WebsocketConnectionStatus,
    errorMessage?: string
  ) {
    entry.status = status
    entry.lastError = errorMessage
    const snapshot = this.snapshot(entry)
    entry.statusListeners.forEach((listener) => {
      try {
        listener(snapshot)
      } catch (error) {
        if (import.meta.env.DEV) {
          devConsole?.error?.(
            `[WebSocket] status listener error for ${entry.chat}`,
            error
          )
        }
      }
    })
  }

  private readonly handleOnline = () => {
    this.online = true
    this.connections.forEach((entry) => {
      if (!this.hasListeners(entry)) {
        return
      }
      if (!entry.socket || entry.pendingReconnect) {
        entry.pendingReconnect = false
        entry.retries = 0
        void this.ensureSocket(entry)
      }
    })
  }

  private readonly handleOffline = () => {
    this.online = false
    this.connections.forEach((entry) => {
      this.clearReconnectTimer(entry)
      entry.pendingReconnect = true
      this.updateStatus(entry, 'error', 'offline')
    })
  }
}

