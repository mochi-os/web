// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: Apache-2.0

// The per-game socket hook shared by chess, go and words. `mergeMove` is the
// only game-specific part: which fields a move payload carries differs per
// game.

import { useCallback, useEffect, useState } from 'react'
import {
  useQueryClient,
  type InfiniteData,
  type QueryClient,
  type QueryKey,
} from '@tanstack/react-query'
import {
  type ChatWebsocketMessagePayload,
  type WebsocketConnectionStatus,
} from '../lib/realtime-websocket-manager'
import { useGameWebsocketManager } from './use-game-websocket-manager'

/**
 * The game fields this hook writes; each app's own Game type is this and more.
 * `draw_offer` and `fen` are optional - words carries neither.
 */
export interface GameWebsocketGame {
  id: string
  status: string
  winner: string | null
  draw_offer?: string | null
  fen?: string
}

export interface GameWebsocketMessage {
  id: string
  game: string
  member: string
  name: string
  body: string
  type: string
  event?: string
  created: number
}

/** The app's query key factory. `moveHistory` is chess-only. */
export interface GameWebsocketKeys {
  all: () => QueryKey
  detail: (gameId: string) => QueryKey
  messages: (gameId: string) => QueryKey
  moveHistory?: (gameId: string) => QueryKey
}

export interface UseGameWebsocketResult {
  status: WebsocketConnectionStatus
  retries: number
  error?: string
  forceReconnect: () => void
}

interface DetailCache {
  game: GameWebsocketGame
}

interface ListCache {
  games: GameWebsocketGame[]
}

interface MessagesPage {
  messages: GameWebsocketMessage[]
}

const isSameMessage = (
  incoming: GameWebsocketMessage,
  existing: GameWebsocketMessage,
): boolean =>
  incoming.created === existing.created &&
  incoming.body === existing.body &&
  incoming.name === existing.name &&
  incoming.type === existing.type

const createMessageFromPayload = (
  gameId: string,
  payload: ChatWebsocketMessagePayload,
  unknownSenderLabel: string,
): GameWebsocketMessage => {
  const created =
    typeof payload.created === 'number'
      ? payload.created
      : Math.floor(Date.now() / 1000)
  const messageBody =
    typeof payload.body === 'string' ? payload.body : String(payload.body ?? '')
  const senderName =
    typeof payload.name === 'string' ? payload.name : unknownSenderLabel
  const senderId = typeof payload.member === 'string' ? payload.member : ''
  const msgType = typeof payload.type === 'string' ? payload.type : 'message'
  const event = typeof payload.event === 'string' ? payload.event : undefined

  return {
    id: `ws-${gameId}-${created}-${Math.random().toString(36).slice(2)}`,
    game: gameId,
    body: messageBody,
    member: senderId,
    name: senderName,
    type: msgType,
    event,
    created,
  }
}

/**
 * Merges the game-specific fields of a move payload; status, winner and the
 * cleared draw offer are applied around it.
 */
export type MergeMovePayload<G extends GameWebsocketGame = GameWebsocketGame> =
  (game: G, payload: ChatWebsocketMessagePayload) => Partial<G>

const handleWebsocketPayload = <G extends GameWebsocketGame>(
  gameId: string,
  payload: ChatWebsocketMessagePayload,
  queryClient: QueryClient,
  unknownSenderLabel: string,
  keys: GameWebsocketKeys,
  mergeMove: MergeMovePayload<G> | undefined,
  snapshotField: string,
) => {
  if (!gameId) return

  const msgType = payload.type as string | undefined
  const event = payload.event as string | undefined

  // Resign / draw accept — the payload carries the final state, so patch the
  // caches directly. Invalidating here would refetch view + list a second time
  // on the actor's side, whose mutation already invalidated.
  if (event === 'resign' || event === 'draw_accept') {
    const status = event === 'resign' ? 'resigned' : 'draw'
    const winner =
      typeof payload.winner === 'string' && payload.winner
        ? payload.winner
        : null
    queryClient.setQueryData<DetailCache>(keys.detail(gameId), (current) => {
      if (!current) return current
      return {
        ...current,
        game: {
          ...current.game,
          status,
          winner: winner ?? current.game.winner,
          draw_offer: null,
        },
      }
    })
    queryClient.setQueryData<ListCache>(keys.all(), (current) => {
      if (!current) return current
      return {
        ...current,
        games: current.games.map((g) =>
          g.id === gameId
            ? { ...g, status, winner: winner ?? g.winner, draw_offer: null }
            : g,
        ),
      }
    })
  }

  if (event === 'draw_offer' || event === 'draw_decline') {
    queryClient.setQueryData<DetailCache>(keys.detail(gameId), (current) => {
      if (!current) return current
      return {
        ...current,
        game: {
          ...current.game,
          draw_offer: (payload.draw_offer as string) || null,
        },
      }
    })
  }

  // A non-move payload carrying a board is a complete applied snapshot. Refetch
  // rather than merge: a merge cannot clear a falsy field (`payload.x ||
  // current.x` keeps a stale winner) and leaves the list showing the old
  // status.
  if (msgType !== 'move' && (payload[snapshotField] || msgType === 'state')) {
    void queryClient.invalidateQueries({
      queryKey: keys.detail(gameId),
      exact: true,
    })
    void queryClient.invalidateQueries({ queryKey: keys.all(), exact: true })
  }

  if (msgType === 'move') {
    // No mergeMove means the game cannot be patched from the frame at all -
    // words' rack and bag are private per-player state, so the copies in the
    // frame are not this viewer's. The refetch below is then the only correct
    // response.
    if (mergeMove) {
      queryClient.setQueryData<DetailCache>(keys.detail(gameId), (current) => {
        if (!current) return current
        return {
          ...current,
          game: {
            ...current.game,
            // The app's own Game is this shape plus its own fields, which is
            // exactly what mergeMove is there to read and write.
            ...mergeMove(current.game as G, payload),
            fen: (payload.fen as string) || current.game.fen,
            status: (payload.status as string) || current.game.status,
            winner: (payload.winner as string) || current.game.winner,
            draw_offer: null,
          },
        }
      })
    }

    // The merge above is responsiveness only; the refetch is authoritative and
    // runs UNCONDITIONALLY. Do not add an own-echo guard: the frame is emitted
    // before the HTTP response returns, and a per-game marker swallows another
    // window's echo.
    if (keys.moveHistory) {
      void queryClient.invalidateQueries({
        queryKey: keys.moveHistory(gameId),
      })
    }
    void queryClient.invalidateQueries({
      queryKey: keys.detail(gameId),
      exact: true,
    })
    void queryClient.invalidateQueries({ queryKey: keys.all(), exact: true })
  }

  // A reconciliation snapshot is a cache signal, not something that happened in
  // the game: it repairs state this client missed and has no message of its
  // own. Appending one would put an empty system entry in the chat.
  if (msgType === 'state') return

  const incomingMessage = createMessageFromPayload(
    gameId,
    payload,
    unknownSenderLabel,
  )

  queryClient.setQueryData<InfiniteData<MessagesPage>>(
    keys.messages(gameId),
    (current) => {
      if (!current || !current.pages || current.pages.length === 0) {
        return {
          pages: [{ messages: [incomingMessage] }],
          pageParams: [undefined],
        }
      }

      const alreadyExists = current.pages.some((page) =>
        page.messages.some((message) => isSameMessage(incomingMessage, message)),
      )

      if (alreadyExists) return current

      const updatedPages = current.pages.map((page, index) =>
        index === 0
          ? { ...page, messages: [...page.messages, incomingMessage] }
          : page,
      )

      return { ...current, pages: updatedPages }
    },
  )
}

export interface UseGameWebsocketOptions<
  G extends GameWebsocketGame = GameWebsocketGame,
> {
  gameId?: string
  /** Per-game socket key, when the app scopes sockets by one. */
  gameKey?: string
  keys: GameWebsocketKeys
  /** Resolved by the app, so no string is added to every app's catalog. */
  unknownSenderLabel: string
  /**
   * Merges the game-specific fields of a move payload. Omit it when the game's
   * state cannot be patched from the frame; the move is then applied by
   * refetching.
   */
  mergeMove?: MergeMovePayload<G>
  /**
   * Payload field whose presence marks a complete applied snapshot. chess and
   * go carry the position as `fen`, words as `board`. Defaults to `fen`.
   */
  snapshotField?: string
}

export function useGameWebsocket<G extends GameWebsocketGame>({
  gameId,
  gameKey,
  keys,
  unknownSenderLabel,
  mergeMove,
  snapshotField = 'fen',
}: UseGameWebsocketOptions<G>): UseGameWebsocketResult {
  const manager = useGameWebsocketManager()
  const queryClient = useQueryClient()
  const [snapshot, setSnapshot] = useState<{
    status: WebsocketConnectionStatus
    retries: number
    lastError?: string
  } | null>(null)

  useEffect(() => {
    setSnapshot(null)

    if (!gameId || !manager) {
      return undefined
    }

    const unsubscribe = manager.subscribe(gameId, {
      chatKey: gameKey,
      onMessage: (event) => {
        handleWebsocketPayload(
          event.chatId,
          event.payload,
          queryClient,
          unknownSenderLabel,
          keys,
          mergeMove,
          snapshotField,
        )
      },
      onStatusChange: (nextSnapshot) => {
        setSnapshot(nextSnapshot)
      },
    })

    return () => {
      unsubscribe()
    }
  }, [
    gameId,
    gameKey,
    manager,
    queryClient,
    unknownSenderLabel,
    keys,
    mergeMove,
    snapshotField,
  ])

  const forceReconnect = useCallback(() => {
    if (gameId && manager) {
      manager.forceReconnect(gameId)
    }
  }, [gameId, manager])

  return {
    status: snapshot?.status ?? 'idle',
    retries: snapshot?.retries ?? 0,
    error: snapshot?.lastError,
    forceReconnect,
  }
}
