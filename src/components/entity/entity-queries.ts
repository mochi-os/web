// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: Apache-2.0

// A project's or CRM's item list and people, as every view of them asks: the
// page, the item panel with its parent picker and links, the create dialog,
// the comment list, and the route loader that starts both before the page
// draws. One key, one fetcher and one freshness window each, so a loader's
// prefetch or a second observer reuses the answer rather than download it
// again. The entity websocket's events and the page's own edits invalidate
// them, and the websocket hook asks again on subscribing (unless just fetched)
// and after a reconnect, for what changed while nothing was listening.

import { queryOptions } from '@tanstack/react-query'

/** How long an item list or people list counts as fresh, in milliseconds. */
export const ENTITY_LIST_FRESH = 60_000

export function entityObjectsQuery<TList extends { objects: unknown[] }>(
  listObjects: (containerId: string) => Promise<{ data: TList }>,
  containerId: string
) {
  return queryOptions({
    queryKey: ['objects', containerId],
    queryFn: async () => (await listObjects(containerId)).data,
    staleTime: ENTITY_LIST_FRESH,
  })
}

export function entityPeopleQuery(
  listPeople: (
    containerId: string
  ) => Promise<{ data: { people: { id: string; name: string }[] } }>,
  containerId: string
) {
  return queryOptions({
    queryKey: ['people', containerId],
    queryFn: async () => (await listPeople(containerId)).data.people,
    staleTime: ENTITY_LIST_FRESH,
  })
}
