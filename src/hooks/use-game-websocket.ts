// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: Apache-2.0

// The per-game socket hook chess and go each grew privately, 276 and 271
// lines. The resignation and draw-offer cache patches, the snapshot refetch,
// the chat append with its duplicate guard, and the subscribe and status
// plumbing were the same in both.
//
// What differs is which fields a move payload carries: chess merges fen and
// pgn, go merges fen, sgf, previous_fen and the capture counts. That is the
// `mergeMove` callback, and it is the only game-specific part left.
//
// The comments below are chess's and go's own, kept because they record why
// the refetch is unconditional. Both apps had reached the same conclusion.

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
 * The game fields this hook writes. Each app's own Game type is this and more.
 *
 * `draw_offer` and `fen` are optional: words has no draw offer to clear, and it
 * carries its position as `board`. Which field marks a repair snapshot is the
 * `snapshotField` option.
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
 * Merges the game-specific fields of a move payload. Everything the shared
 * hook already handles — status, winner, the cleared draw offer — is applied
 * around whatever this returns.
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

  // Any non-move payload carrying a board is a complete applied snapshot: a
  // system event whose snapshot repaired a move this client never saw, or a
  // reconciliation 'state' payload. Refetch rather than merging field by
  // field. A snapshot REPLACES state, and a merge cannot clear a value the way
  // an exact replacement does — an emptied winner or draw offer is falsy, so
  // `payload.x || current.x` silently keeps the stale one. Refetching also
  // updates the list, which a detail-only merge left showing the old status.
  // A 'state' frame is a repair by definition and counts whether or not it
  // carries the position field; words' own hook treated it that way, and chess
  // and go only ever saw one with a fen, so neither noticed the difference.
  if (msgType !== 'move' && (payload[snapshotField] || msgType === 'state')) {
    void queryClient.invalidateQueries({
      queryKey: keys.detail(gameId),
      exact: true,
    })
    void queryClient.invalidateQueries({ queryKey: keys.all(), exact: true })
  }

  if (msgType === 'move') {
    // No mergeMove means the game cannot be patched from the payload at all.
    // words is the case: its rack and bag are private per-player state, so the
    // copies in the frame are not the ones this viewer is entitled to, and the
    // refetch below is the only correct response. Games that can patch do, for
    // responsiveness, and still refetch afterwards.
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

    // The merge above is for responsiveness only. A move payload is a complete
    // snapshot like any other, and the merge cannot clear falsy fields (an
    // emptied winner survives `payload.x || current.x`) or update the list,
    // which otherwise shows "active" after a remote win. Authoritative state
    // comes from the refetch, and it runs UNCONDITIONALLY. An own-echo guard
    // used to sit here and had two holes: the server emits this frame before
    // the HTTP response returns, so a response lost after commit consumed the
    // marker and left the list stale; and the marker was keyed by game alone,
    // so a failed move's marker could swallow the echo of another window's
    // successful one. One redundant refetch per own move is the price of not
    // coupling correctness to HTTP/websocket ordering.
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
   * state cannot be patched from the frame, as words' cannot: the move is then
   * applied by refetching alone.
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
