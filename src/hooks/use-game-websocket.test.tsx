// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: Apache-2.0

// A move frame writes its game's row of the games list rather than every open
// page downloading the whole list again for each move. The list is asked for
// again when a move ends the game, when the list does not hold the game, when
// the frame cannot be trusted for the row (words), and when the socket comes
// back from a drop.

import type { ReactNode } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { GameWebsocketContext } from '../context/game-websocket-context'
import type {
  ChatWebsocketListener,
  ChatWebsocketManager,
  ChatWebsocketStatusListener,
  WebsocketConnectionStatus,
} from '../lib/realtime-websocket-manager'
import {
  useGameWebsocket,
  type GameWebsocketGame,
  type MergeMovePayload,
} from './use-game-websocket'

const keys = {
  all: () => ['games'],
  detail: (gameId: string) => ['games', gameId],
  messages: (gameId: string) => ['games', gameId, 'messages'],
  moveHistory: (gameId: string) => ['games', gameId, 'moves'],
}

/** A manager whose one subscription the test drives by hand. */
function fakeManager() {
  let message: ChatWebsocketListener | undefined
  let status: ChatWebsocketStatusListener | undefined
  const manager = {
    subscribe: (
      _chat: string,
      options: {
        onMessage?: ChatWebsocketListener
        onStatusChange?: ChatWebsocketStatusListener
      }
    ) => {
      message = options.onMessage
      status = options.onStatusChange
      return () => {}
    },
    forceReconnect: () => {},
  } as unknown as ChatWebsocketManager
  return {
    manager,
    send: (payload: Record<string, unknown>) =>
      message?.({ chat: 'g1', payload }),
    status: (next: WebsocketConnectionStatus) =>
      status?.({ chat: 'g1', status: next, retries: 0 }),
  }
}

interface Row extends GameWebsocketGame {
  updated: number
  captures_black?: number
}

// go's merge: the SGF and the captures, of which a list row carries only the
// captures.
const mergeMove: MergeMovePayload<Row> = (game, payload) => ({
  sgf: payload.sgf as string,
  captures_black:
    typeof payload.captures_black === 'number'
      ? payload.captures_black
      : game.captures_black,
})

const moved = {
  id: 'g1',
  status: 'active',
  winner: null,
  draw_offer: 'other',
  fen: 'before',
  captures_black: 0,
  updated: 100,
}

const unmoved = {
  id: 'g2',
  status: 'active',
  winner: null,
  fen: 'other',
  updated: 50,
}

// null for a game whose frames cannot be patched, which passes no merge.
function setup(
  merge: MergeMovePayload<Row> | null = mergeMove,
  games: Record<string, unknown>[] = [moved, unmoved]
) {
  const client = new QueryClient()
  client.setQueryData(keys.all(), { games })
  client.setQueryData(keys.detail('g1'), {
    game: { id: 'g1', status: 'active', winner: null, fen: 'before' },
  })
  client.setQueryData(keys.messages('g1'), {
    pages: [{ messages: [] }],
    pageParams: [undefined],
  })
  client.setQueryData(keys.moveHistory('g1'), { moves: [] })
  const socket = fakeManager()
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>
      <GameWebsocketContext.Provider value={socket.manager}>
        {children}
      </GameWebsocketContext.Provider>
    </QueryClientProvider>
  )
  renderHook(
    () =>
      useGameWebsocket<Row>({
        gameId: 'g1',
        keys,
        unknownSenderLabel: 'Unknown',
        mergeMove: merge ?? undefined,
      }),
    { wrapper }
  )
  const list = () =>
    client.getQueryData<{ games: Record<string, unknown>[] }>(keys.all())!.games
  const stale = (key: unknown[]) =>
    client.getQueryState(key)?.isInvalidated ?? false
  return { socket, list, stale }
}

const move = {
  type: 'move',
  fen: 'after',
  status: 'active',
  winner: '',
  draw_offer: '',
  sgf: ';B[dd]',
  captures_black: 2,
  member: 'opponent',
  name: 'Opponent',
  body: 'D4',
  created: 200,
}

describe('useGameWebsocket move frames and the games list', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date(1_000_000_000))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it("writes the move into its game's row without downloading the list", () => {
    const { socket, list, stale } = setup()
    act(() => socket.send(move))

    // The columns the row carries, and nothing it does not: no SGF.
    expect(list()[0]).toEqual({
      id: 'g1',
      status: 'active',
      winner: null,
      draw_offer: null,
      fen: 'after',
      captures_black: 2,
      updated: 1_000_000,
    })
    expect(list()[1]).toEqual(unmoved)
    expect(stale(keys.all())).toBe(false)
    // The game itself is still refetched on every move.
    expect(stale(keys.detail('g1'))).toBe(true)
  })

  it("takes the frame's own time when it carries one", () => {
    const { socket, list } = setup()
    act(() => socket.send({ ...move, updated: 300 }))
    expect(list()[0].updated).toBe(300)
  })

  it('downloads the list again when the move ends the game', () => {
    const { socket, list, stale } = setup()
    act(() => socket.send({ ...move, status: 'checkmate', winner: 'opponent' }))
    expect(list()[0]).toMatchObject({ status: 'checkmate', winner: 'opponent' })
    expect(stale(keys.all())).toBe(true)
  })

  it('downloads the list again when it does not hold the game', () => {
    const { socket, list, stale } = setup(mergeMove, [unmoved])
    act(() => socket.send(move))
    expect(list()).toEqual([unmoved])
    expect(stale(keys.all())).toBe(true)
  })

  it('downloads the list again for a game whose frame cannot be trusted', () => {
    const { socket, list, stale } = setup(null)
    act(() => socket.send(move))
    expect(list()[0]).toEqual(moved)
    expect(stale(keys.all())).toBe(true)
  })
})

describe('useGameWebsocket reconnects', () => {
  // Every frame sent while the socket was down never arrived: the game, its
  // moves, its chat and the list are asked for again when it is back.
  const missed = [
    keys.detail('g1'),
    keys.moveHistory('g1'),
    keys.messages('g1'),
    keys.all(),
  ]

  it('asks for nothing when the socket first opens', () => {
    const { socket, stale } = setup()
    act(() => socket.status('connecting'))
    act(() => socket.status('ready'))
    expect(missed.map(stale)).toEqual([false, false, false, false])
  })

  it('asks for nothing while the socket is still down', () => {
    const { socket, stale } = setup()
    act(() => socket.status('ready'))
    act(() => socket.status('error'))
    act(() => socket.status('connecting'))
    expect(missed.map(stale)).toEqual([false, false, false, false])
  })

  it('asks again for the game when the socket comes back', () => {
    const { socket, stale } = setup()
    act(() => socket.status('ready'))
    act(() => socket.status('error'))
    act(() => socket.status('ready'))
    expect(stale(keys.detail('g1'))).toBe(true)
  })

  it('asks again for its moves when the socket comes back', () => {
    const { socket, stale } = setup()
    act(() => socket.status('ready'))
    act(() => socket.status('error'))
    act(() => socket.status('ready'))
    expect(stale(keys.moveHistory('g1'))).toBe(true)
  })

  it('asks again for its chat when the socket comes back', () => {
    const { socket, stale } = setup()
    act(() => socket.status('ready'))
    act(() => socket.status('error'))
    act(() => socket.status('ready'))
    expect(stale(keys.messages('g1'))).toBe(true)
  })

  it('asks again for the list when the socket comes back', () => {
    const { socket, stale } = setup()
    act(() => socket.status('ready'))
    act(() => socket.status('error'))
    act(() => socket.status('ready'))
    expect(stale(keys.all())).toBe(true)
  })
})
