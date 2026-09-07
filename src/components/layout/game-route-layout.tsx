// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: Apache-2.0

// The route layout shared by chess, go and words. Each app used to carry its
// own copy of this wiring: the provider, the route-to-context game sync, and
// the two context values GameLayout needs. What differs per app - the entry
// title, the avatar identity, the badge, the labels and the NewGame dialog -
// stays a prop, so no Lingui string lives here.

import { useEffect, type ReactNode } from 'react'
import { useParams } from '@tanstack/react-router'
import {
  GameLayout,
  type GameSummary,
  type GameLayoutLabels,
} from './game-layout'
import {
  GameSidebarProvider,
  useGameSidebarContext,
} from '../../context/game-sidebar-context'

interface GameRouteLayoutProps<G extends GameSummary> {
  games: G[]
  /** Path segment the asset proxy is mounted under, e.g. "chess". */
  appName?: string
  /** The other player's identity, so their avatar can be fetched. */
  opponentId?: (game: G) => string
  /** What the sidebar entry reads. go appends the board size here. */
  gameTitle: (game: G) => string
  /** Short marker on an entry, e.g. words' "!" for the games awaiting you. */
  badge?: (game: G) => string | undefined
  labels: GameLayoutLabels
  /** The app's NewGame dialog. Rendered inside the provider it reads from. */
  newGameDialog?: ReactNode
  children?: ReactNode
}

function GameRouteLayoutInner<G extends GameSummary>({
  games,
  appName,
  opponentId,
  gameTitle,
  badge,
  labels,
  children,
}: Omit<GameRouteLayoutProps<G>, 'newGameDialog'>) {
  const { setGame, openNewGameDialog, websocketStatusMeta, gameId } =
    useGameSidebarContext()

  const params = useParams({ strict: false }) as { gameId?: string }
  const urlGameId = params?.gameId

  // Only the route id and the stable setter belong here. chess and go also
  // listed `games` and `myIdentity`, neither of which the effect reads.
  useEffect(() => {
    setGame(urlGameId ?? null)
  }, [urlGameId, setGame])

  return (
    <GameLayout
      games={games}
      appName={appName}
      gameTitle={gameTitle}
      opponentId={opponentId}
      badge={badge}
      onNewGame={openNewGameDialog}
      websocketStatus={gameId ? websocketStatusMeta : null}
      labels={labels}
    >
      {children}
    </GameLayout>
  )
}

export function GameRouteLayout<G extends GameSummary>({
  newGameDialog,
  ...inner
}: GameRouteLayoutProps<G>) {
  return (
    <GameSidebarProvider>
      <GameRouteLayoutInner {...inner} />
      {newGameDialog}
    </GameSidebarProvider>
  )
}
