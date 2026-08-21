// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: Apache-2.0

// The app shell shared by chess, go and words. Each app keeps its own NewGame
// dialog and title callback; the avatar and badge are optional because words
// has neither. Every string arrives resolved from the app.

import { useMemo, type FC, type ReactNode } from 'react'
import { Plus } from 'lucide-react'
import { AuthenticatedLayout } from './authenticated-layout'
import type { SidebarData } from './types'
import { useSidebar } from '../ui/sidebar'
import { EntityAvatar } from '../entity-avatar'
import { cn } from '../../lib/utils'

/** The game fields the shell reads. Each app's own Game is this and more. */
export interface GameSummary {
  id: string
  updated: number
  status: string
}

export interface GameLayoutLabels {
  active: string
  completed: string
  newGame: string
}

const opponentIconCache = new Map<string, FC>()

function opponentIcon(
  appName: string,
  gameId: string,
  opponentId: string,
): FC {
  // Served by the app's own asset proxy, never by a direct /people/ fetch:
  // inside the shell iframe a cross-app request goes out anonymous, and for a
  // remote opponent there is no local /people/ entity at all - the proxy
  // resolves them over P2P.
  const cacheKey = `${appName}:${gameId}:${opponentId}`
  let Icon = opponentIconCache.get(cacheKey)
  if (!Icon) {
    Icon = function OpponentIcon() {
      return (
        <EntityAvatar
          src={`/${appName}/${gameId}/-/user/${opponentId}/asset/avatar`}
          styleUrl={`/${appName}/${gameId}/-/user/${opponentId}/asset/style`}
          size="xs"
        />
      )
    }
    // eslint-disable-next-line lingui/no-unlocalized-strings -- React displayName is dev-tooling only, not user-facing
    Icon.displayName = `OpponentIcon(${opponentId})`
    opponentIconCache.set(cacheKey, Icon)
  }
  return Icon
}

function WebsocketStatusIndicator({
  status,
}: {
  status?: { color: string; label: string } | null
}) {
  const { state } = useSidebar()
  const isCollapsed = state === 'collapsed'

  if (!status) return null

  return (
    <div
      className={cn(
        'text-muted-foreground flex items-center gap-2 px-2 py-2 text-xs',
        isCollapsed && 'justify-center px-0',
      )}
    >
      <span
        className={cn('h-2 w-2 flex-shrink-0 rounded-full', status.color)}
      />
      {!isCollapsed && <span>{status.label}</span>}
    </div>
  )
}

interface GameLayoutProps<G extends GameSummary> {
  games: G[]
  /**
   * Path segment the asset proxy is mounted under, e.g. "chess". Required to
   * draw opponent avatars; omit it, like words, and the entries carry no icon.
   */
  appName?: string
  /** The other player's identity, so their avatar can be fetched. */
  opponentId?: (game: G) => string
  /** What the sidebar entry reads. go appends the board size here. */
  gameTitle: (game: G) => string
  /** Short marker on an entry, e.g. words' "!" for the games awaiting you. */
  badge?: (game: G) => string | undefined
  labels: GameLayoutLabels
  onNewGame: () => void
  /** Connection dot in the sidebar footer. Omit to hide it. */
  websocketStatus?: { color: string; label: string } | null
  children?: ReactNode
}

export function GameLayout<G extends GameSummary>({
  games,
  appName,
  opponentId,
  gameTitle,
  badge,
  labels,
  onNewGame,
  websocketStatus,
  children,
}: GameLayoutProps<G>) {
  const { active, completed, newGame } = labels

  const sidebarData: SidebarData = useMemo(() => {
    const sorted = [...games].sort((a, b) => b.updated - a.updated)
    const activeGames = sorted.filter((g) => g.status === 'active')
    const completedGames = sorted.filter((g) => g.status !== 'active')

    const entry = (game: G) => ({
      title: gameTitle(game),
      url: `/${game.id}`,
      icon:
        appName && opponentId
          ? opponentIcon(appName, game.id, opponentId(game))
          : undefined,
      badge: badge?.(game),
    })

    const groups: SidebarData['navGroups'] = []

    if (activeGames.length > 0) {
      groups.push({
        title: active,
        items: activeGames.map(entry),
      })
    }

    if (completedGames.length > 0) {
      groups.push({
        title: completed,
        // Styled like words' completed entries rather than printing the raw
        // untranslated status enum after the name.
        items: completedGames.map((game) => ({
          ...entry(game),
          className: 'text-muted-foreground',
        })),
      })
    }

    groups.push({
      title: '',
      separator: true,
      items: [
        {
          title: newGame,
          onClick: onNewGame,
          icon: Plus,
        },
      ],
    })

    return { navGroups: groups }
  }, [
    games,
    appName,
    opponentId,
    gameTitle,
    badge,
    onNewGame,
    active,
    completed,
    newGame,
  ])

  return (
    <AuthenticatedLayout
      sidebarData={sidebarData}
      sidebarFooter={<WebsocketStatusIndicator status={websocketStatus} />}
    >
      {children}
    </AuthenticatedLayout>
  )
}
