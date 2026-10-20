// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: Apache-2.0

// Which game a game app's view is showing, and when that view starts over.
// Chess, go and words each keep one view mounted across their games' route.

/**
 * The `remountDeps` of a game route: a fresh view for every game.
 *
 * Kept mounted, the view carried its open questions and pickers across a game
 * change. Dialogs block the sidebar, but Back or a swipe-back does not, and a
 * Resign, Delete, Pass, promotion or blank-letter choice then acted on the game
 * that had just opened.
 */
export function remountPerGame({
  params,
}: {
  params: { gameId: string }
}): string {
  return params.gameId
}

/**
 * The game the route has open: its list entry, else its detail row while the
 * list is behind.
 *
 * The list is for navigation. A new game is opened before the list refetch
 * that names it lands, and a list that failed to refresh must not hide a game
 * that loaded. Once the list is current and lacks the game, the game is gone,
 * whatever the cached detail row still says, and so is a game whose detail
 * request failed.
 *
 * @param listBehind The list is refetching or its last request failed.
 */
export function openGame<G extends { id: string }>(
  games: readonly G[],
  gameId: string | undefined,
  detail: G | undefined,
  detailError: unknown,
  listBehind: boolean
): G | null {
  if (!gameId) return null
  const listed = games.find((g) => g.id === gameId)
  if (listed) return listed
  if (!listBehind || detailError) return null
  return detail?.id === gameId ? detail : null
}
