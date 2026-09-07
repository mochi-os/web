// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: Apache-2.0

// Fixture strings only. No lingui macro in this file: every app's
// lingui.config.js scans lib/web/src/**, so fixtures would be extracted.

import type { ReactNode } from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { GameRouteLayout } from './game-route-layout'
import { useGameSidebarContext } from '../../context/game-sidebar-context'

const mockParams = vi.fn(() => ({}) as { gameId?: string })

vi.mock('@tanstack/react-router', () => ({
  useParams: () => mockParams(),
}))

// GameLayout renders the whole app shell, which is not what this file is
// about. Only the props it receives matter here.
const layoutProps = vi.fn()
vi.mock('./game-layout', () => ({
  GameLayout: (props: Record<string, unknown>) => {
    layoutProps(props)
    return <div data-testid='shell'>{props.children as ReactNode}</div>
  },
}))

const games = [{ id: 'g1', updated: 1, status: 'active' }]
const labels = { active: 'Active', completed: 'Completed', newGame: 'New' }

function Probe() {
  const { gameId } = useGameSidebarContext()
  return <div data-testid='probe'>{gameId ?? 'none'}</div>
}

describe('GameRouteLayout', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockParams.mockReturnValue({})
  })

  it('renders its children inside the shell', () => {
    render(
      <GameRouteLayout games={games} gameTitle={() => 'x'} labels={labels}>
        <div data-testid='page'>page</div>
      </GameRouteLayout>
    )

    expect(screen.getByTestId('shell')).toBeInTheDocument()
    expect(screen.getByTestId('page')).toBeInTheDocument()
  })

  it('renders the new game dialog inside the provider', () => {
    render(
      <GameRouteLayout
        games={games}
        gameTitle={() => 'x'}
        labels={labels}
        newGameDialog={<div data-testid='dialog'>dialog</div>}
      />
    )

    expect(screen.getByTestId('dialog')).toBeInTheDocument()
  })

  it('puts the route gameId into the sidebar context', () => {
    mockParams.mockReturnValue({ gameId: 'g1' })

    render(
      <GameRouteLayout games={games} gameTitle={() => 'x'} labels={labels}>
        <Probe />
      </GameRouteLayout>
    )

    expect(screen.getByTestId('probe')).toHaveTextContent('g1')
  })

  it('clears the sidebar game when the route has no gameId', () => {
    render(
      <GameRouteLayout games={games} gameTitle={() => 'x'} labels={labels}>
        <Probe />
      </GameRouteLayout>
    )

    expect(screen.getByTestId('probe')).toHaveTextContent('none')
  })

  it('hides the websocket dot until a game is selected', () => {
    render(
      <GameRouteLayout games={games} gameTitle={() => 'x'} labels={labels} />
    )

    expect(layoutProps).toHaveBeenCalledWith(
      expect.objectContaining({ websocketStatus: null })
    )
  })

  it('shows the websocket status once a game is selected', () => {
    mockParams.mockReturnValue({ gameId: 'g1' })

    render(
      <GameRouteLayout games={games} gameTitle={() => 'x'} labels={labels} />
    )

    const last = layoutProps.mock.calls.at(-1)?.[0] as {
      websocketStatus: unknown
    }
    expect(last.websocketStatus).not.toBeNull()
  })

  it('passes the per-app callbacks straight through', () => {
    const gameTitle = () => 'title'
    const opponentId = () => 'op'
    const badge = () => '!'

    render(
      <GameRouteLayout
        games={games}
        appName='chess'
        gameTitle={gameTitle}
        opponentId={opponentId}
        badge={badge}
        labels={labels}
      />
    )

    expect(layoutProps).toHaveBeenCalledWith(
      expect.objectContaining({
        games,
        appName: 'chess',
        gameTitle,
        opponentId,
        badge,
        labels,
      })
    )
  })
})
