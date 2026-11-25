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
import type { EntityAttachment, EntityComment } from '../../types/entity-object'

/** How long an item list or people list counts as fresh, in milliseconds. */
export const ENTITY_LIST_FRESH = 60_000

// How many item-list fetches have begun, for every container alike.
let fetches = 0

/**
 * The count of item-list fetches begun so far. Each list carries the count
 * its own fetch began at as `fetch`, so a list whose count is greater than
 * the one a write was answered at was asked for after it, and holds it.
 */
export function entityObjectsFetches() {
  return fetches
}

export function entityObjectsQuery<TList extends { objects: unknown[] }>(
  listObjects: (containerId: string) => Promise<{ data: TList }>,
  containerId: string
) {
  return queryOptions({
    queryKey: ['objects', containerId],
    queryFn: async (): Promise<TList & { fetch: number }> => {
      const number = ++fetches
      return { ...(await listObjects(containerId)).data, fetch: number }
    },
    staleTime: ENTITY_LIST_FRESH,
  })
}

/**
 * How long an item's comments or attachments count as fresh, in
 * milliseconds. The item panel starts both as it opens, and its tab bodies,
 * which mount once the panel's slide has settled, take that answer rather
 * than ask again. Only that long: nothing asks for them again when the page's
 * websocket subscribes, so an item opened later reads them afresh.
 */
export const ENTITY_ITEM_FRESH = 5_000

/** An item's comments, as the comment list and the item panel ask for them. */
export function entityCommentsQuery(
  listComments: (
    containerId: string,
    objectId: string
  ) => Promise<{ data: { comments: EntityComment[]; count: number } }>,
  containerId: string,
  objectId: string
) {
  return queryOptions({
    queryKey: ['comments', containerId, objectId],
    queryFn: async () => (await listComments(containerId, objectId)).data,
    staleTime: ENTITY_ITEM_FRESH,
  })
}

/** An item's attachments, as the attachments field and the item panel ask
 * for them. */
export function entityAttachmentsQuery(
  listAttachments: (
    containerId: string,
    objectId: string
  ) => Promise<{ data: { attachments: EntityAttachment[] } }>,
  containerId: string,
  objectId: string
) {
  return queryOptions({
    queryKey: ['attachments', containerId, objectId],
    queryFn: async () =>
      (await listAttachments(containerId, objectId)).data.attachments,
    staleTime: ENTITY_ITEM_FRESH,
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
