// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: Apache-2.0

import { createElement, type ReactNode } from 'react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  QueryClient,
  QueryClientProvider,
  focusManager,
} from '@tanstack/react-query'
import { act, renderHook } from '@testing-library/react'
import { GameWebsocketContext } from '../context/game-websocket-context'
import type { ChatWebsocketManager } from '../lib/realtime-websocket-manager'
import { createGameHooks, type GameApiShape } from './create-game-hooks'

function makeApi() {
  let answer!: (value: unknown) => void
  const detail = vi.fn(
    () =>
      new Promise((resolve) => {
        answer = resolve
      })
  )
  const api = {
    list: vi.fn(),
    detail,
    messages: vi.fn(),
    sendMessage: vi.fn(),
    move: vi.fn(),
    resign: vi.fn(),
    delete: vi.fn(),
    getFriendsForNewGame: vi.fn(),
  } as unknown as GameApiShape
  return { api, detail, answer: (value: unknown) => answer(value) }
}

describe('gameKey', () => {
  it("joins the page's request for the game rather than sending another", async () => {
    // The page's detail query is on its way when the websocket asks for the
    // key; a second view would also clear the game's notifications again.
    const { api, detail, answer } = makeApi()
    const { gameKey, gameKeys } = createGameHooks(api)
    const client = new QueryClient()
    const page = client.fetchQuery({
      queryKey: gameKeys.detail('g1'),
      queryFn: () => api.detail('g1'),
    })
    const key = gameKey(client, 'g1')
    answer({ game: { id: 'g1', key: 'k1' } })
    await page
    expect(await key).toBe('k1')
    expect(detail).toHaveBeenCalledTimes(1)
  })

  it('uses the game the page already holds, however old', async () => {
    const { api, detail } = makeApi()
    const { gameKey, gameKeys } = createGameHooks(api)
    const client = new QueryClient()
    client.setQueryData(gameKeys.detail('g1'), {
      game: { id: 'g1', key: 'k1' },
    })
    expect(await gameKey(client, 'g1')).toBe('k1')
    expect(detail).not.toHaveBeenCalled()
  })

  it('asks for the game when nothing holds it', async () => {
    const { api, detail, answer } = makeApi()
    const { gameKey } = createGameHooks(api)
    const key = gameKey(new QueryClient(), 'g1')
    answer({ game: { id: 'g1', key: 'k1' } })
    expect(await key).toBe('k1')
    expect(detail).toHaveBeenCalledWith('g1')
  })
})

interface MovePayload {
  fen: string
  status?: string
  winner?: string
}

/** An api shaped like chess's, whose list and move answer at once. */
function playable() {
  const list = vi.fn(() =>
    Promise.resolve({
      games: [
        {
          id: 'g1',
          status: 'active',
          winner: null,
          draw_offer: 'g2-player',
          fen: 'before',
          updated: 100,
        },
      ],
    })
  )
  const api = {
    list,
    detail: vi.fn(() => Promise.resolve({ game: { id: 'g1' } })),
    messages: vi.fn(() => Promise.resolve({ messages: [], more: false })),
    sendMessage: vi.fn(),
    move: vi.fn((_gameId: string, _payload: MovePayload) =>
      Promise.resolve({ id: 'm1' })
    ),
    resign: vi.fn(),
    delete: vi.fn(),
    getFriendsForNewGame: vi.fn(),
  }
  return { api, list }
}

/** Game sockets the test opens and drops by hand. */
function sockets() {
  let open = false
  const watchers = new Set<() => void>()
  const manager = {
    ready: () => open,
    watch: (watcher: () => void) => {
      watchers.add(watcher)
      return () => watchers.delete(watcher)
    },
  } as unknown as ChatWebsocketManager
  const set = (next: boolean) => {
    open = next
    watchers.forEach((watcher) => watcher())
  }
  return { manager, set }
}

function wrap(
  client: QueryClient,
  manager: ChatWebsocketManager | null = null
) {
  return ({ children }: { children: ReactNode }) =>
    createElement(
      QueryClientProvider,
      { client },
      createElement(GameWebsocketContext.Provider, { value: manager }, children)
    )
}

// Lets a fetch answer and the cache tell its observers.
const settle = () => act(() => new Promise((resolve) => setTimeout(resolve, 0)))

describe('useMoveMutation and the games list', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date(1_000_000_000))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  async function play(patch: boolean, move: MovePayload) {
    const { api } = playable()
    const { useMoveMutation, gameKeys } = createGameHooks(api, { patch })
    const client = new QueryClient()
    client.setQueryData(gameKeys.all(), await api.list())
    const { result } = renderHook(() => useMoveMutation(), {
      wrapper: wrap(client),
    })
    await act(() => result.current.mutateAsync({ gameId: 'g1', ...move }))
    const row = client.getQueryData<{ games: Record<string, unknown>[] }>(
      gameKeys.all()
    )!.games[0]
    const stale = client.getQueryState(gameKeys.all())?.isInvalidated
    return { row, stale }
  }

  it('writes an accepted move into the row without downloading the list', async () => {
    const { row, stale } = await play(true, { fen: 'after' })
    expect(row).toEqual({
      id: 'g1',
      status: 'active',
      winner: null,
      draw_offer: null,
      fen: 'after',
      updated: 1_000_000,
    })
    expect(stale).toBe(false)
  })

  it('downloads the list again when the move ends the game', async () => {
    const { row, stale } = await play(true, {
      fen: 'after',
      status: 'checkmate',
      winner: 'me',
    })
    expect(row).toMatchObject({ status: 'checkmate', winner: 'me' })
    expect(stale).toBe(true)
  })

  it('downloads the list again for a game that cannot be patched', async () => {
    const { row, stale } = await play(false, { fen: 'after' })
    expect(row).toMatchObject({ fen: 'before', updated: 100 })
    expect(stale).toBe(true)
  })
})

describe('useGamesQuery polling', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] })
    focusManager.setFocused(true)
  })

  afterEach(() => {
    focusManager.setFocused(undefined)
    vi.useRealTimers()
  })

  it('polls the list only while no game socket is open', async () => {
    const { api, list } = playable()
    const { useGamesQuery } = createGameHooks(api)
    const socket = sockets()
    renderHook(() => useGamesQuery(), {
      wrapper: wrap(new QueryClient(), socket.manager),
    })
    await settle()
    expect(list).toHaveBeenCalledTimes(1)

    act(() => vi.advanceTimersByTime(30_000))
    await settle()
    expect(list).toHaveBeenCalledTimes(2)

    act(() => socket.set(true))
    act(() => vi.advanceTimersByTime(90_000))
    await settle()
    expect(list).toHaveBeenCalledTimes(2)

    // The socket dropped: polling is the repair until it is back.
    act(() => socket.set(false))
    act(() => vi.advanceTimersByTime(30_000))
    await settle()
    expect(list).toHaveBeenCalledTimes(3)
  })

  it('asks for the list again when the window regains focus', async () => {
    const { api, list } = playable()
    const { useGamesQuery } = createGameHooks(api)
    const socket = sockets()
    socket.set(true)
    // As in development, where the shared client turns focus refetches off.
    const client = new QueryClient({
      defaultOptions: { queries: { refetchOnWindowFocus: false } },
    })
    renderHook(() => useGamesQuery(), {
      wrapper: wrap(client, socket.manager),
    })
    await settle()
    expect(list).toHaveBeenCalledTimes(1)

    act(() => {
      focusManager.setFocused(false)
      focusManager.setFocused(true)
    })
    await settle()
    expect(list).toHaveBeenCalledTimes(2)
  })
})
