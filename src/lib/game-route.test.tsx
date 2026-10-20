// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: Apache-2.0

import { useEffect } from 'react'
import { describe, it, expect } from 'vitest'
import { render, screen, act } from '@testing-library/react'
import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  Outlet,
  RouterProvider,
} from '@tanstack/react-router'
import { openGame, remountPerGame } from './game-route'

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
