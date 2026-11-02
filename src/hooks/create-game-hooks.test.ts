// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: Apache-2.0

import { describe, it, expect, vi } from 'vitest'
import { QueryClient } from '@tanstack/react-query'
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
