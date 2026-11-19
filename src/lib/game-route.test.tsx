// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: Apache-2.0

import { useEffect } from 'react'
import { describe, it, expect, vi } from 'vitest'
import { render, screen, act } from '@testing-library/react'
import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  isNotFound,
  Outlet,
  RouterProvider,
} from '@tanstack/react-router'
import { openGame, parseGameParams, remountPerGame } from './game-route'

const a = { id: 'a', status: 'active' }
const b = { id: 'b', status: 'active' }

describe('remountPerGame', () => {
  it('gives each game its own view', () => {
    expect(remountPerGame({ params: { gameId: 'a' } })).not.toBe(
      remountPerGame({ params: { gameId: 'b' } })
    )
  })

  it('keeps the view for the same game', () => {
    expect(remountPerGame({ params: { gameId: 'a' } })).toBe(
      remountPerGame({ params: { gameId: 'a' } })
    )
  })

  it('starts the route view over on a switch and on Back', async () => {
    let mounts = 0
    function View() {
      useEffect(() => {
        mounts++
      }, [])
      return <p>{gameRoute.useParams().gameId}</p>
    }
    const root = createRootRoute({ component: Outlet })
    const gameRoute = createRoute({
      getParentRoute: () => root,
      path: '$gameId',
      remountDeps: remountPerGame,
      component: View,
    })
    const router = createRouter({
      routeTree: root.addChildren([gameRoute]),
      history: createMemoryHistory({ initialEntries: ['/a'] }),
    })
    render(<RouterProvider router={router} />)
    await screen.findByText('a')
    expect(mounts).toBe(1)

    await act(() =>
      router.navigate({ to: '/$gameId', params: { gameId: 'b' } })
    )
    await screen.findByText('b')
    expect(mounts).toBe(2)

    await act(() => router.history.back())
    await screen.findByText('a')
    expect(mounts).toBe(3)
  })
})

describe('parseGameParams', () => {
  const GAME = '0193a1b2c3d4e5f60718293a4b5c6d7e'

  it('takes a game id', () => {
    expect(parseGameParams({ gameId: GAME })).toEqual({ gameId: GAME })
  })

  it.each([
    ['a decoded climb', `${GAME}/%2D/resign?`],
    ['a short id', GAME.slice(1)],
    ['upper case', GAME.toUpperCase()],
    ['empty', ''],
  ])('answers not-found for %s', (_name, gameId) => {
    let error: unknown
    try {
      parseGameParams({ gameId })
    } catch (e) {
      error = e
    }
    expect(isNotFound(error)).toBe(true)
  })

  it('renders not-found for the route, with nothing loaded', async () => {
    const loader = vi.fn(() => null)
    const root = createRootRoute({ component: Outlet })
    const gameRoute = createRoute({
      getParentRoute: () => root,
      path: '$gameId',
      params: { parse: parseGameParams },
      remountDeps: remountPerGame,
      loader,
      component: () => <p>{gameRoute.useParams().gameId}</p>,
      notFoundComponent: () => <p>not found</p>,
    })
    const router = createRouter({
      routeTree: root.addChildren([gameRoute]),
      history: createMemoryHistory({
        initialEntries: [`/${GAME}%2F%252D%2Fresign%3F`],
      }),
    })
    render(<RouterProvider router={router} />)
    await screen.findByText('not found')
    expect(loader).not.toHaveBeenCalled()

    // CONTROL: a game id loads.
    await act(() =>
      router.navigate({ to: '/$gameId', params: { gameId: GAME } })
    )
    await screen.findByText(GAME)
    expect(loader).toHaveBeenCalledTimes(1)
  })
})

describe('openGame', () => {
  it('takes the list entry when the list has the game', () => {
    const listed = { ...a, status: 'finished' }
    expect(openGame([listed, b], 'a', a, null, false)).toBe(listed)
  })

  it('falls back to the detail row while the list is behind', () => {
    expect(openGame([b], 'a', a, null, true)).toBe(a)
    expect(openGame([], 'a', a, null, true)).toBe(a)
  })

  it('trusts a current list that no longer has the game', () => {
    expect(openGame([b], 'a', a, null, false)).toBeNull()
  })

  it('never shows the detail row of another game', () => {
    expect(openGame([], 'a', b, null, true)).toBeNull()
  })

  it('shows nothing once the detail request fails', () => {
    expect(openGame([], 'a', a, new Error('gone'), true)).toBeNull()
  })

  it('shows nothing with no game in the route', () => {
    expect(openGame([a], undefined, a, null, true)).toBeNull()
  })
})
