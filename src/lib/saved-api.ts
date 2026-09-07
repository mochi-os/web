// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: Apache-2.0

// The saved-posts calls an app makes against its own `saved` endpoints. Feeds
// and forums carried byte-identical copies of all four; only the snapshot they
// persist differs, because their post shapes do.

import { createAppClient } from './create-app-client'

/** Actions answer either with the payload or with it inside `data`. */
type Wrapped<T> = T | { data: T }

const unwrap = <T>(payload: Wrapped<T>): T =>
  payload && typeof payload === 'object' && 'data' in payload
    ? (payload as { data: T }).data
    : (payload as T)

export interface SavedEndpoints {
  list: string
  add: string
  remove: string
  clear: string
}

export interface SavedApi<TPost, TSaved> {
  list: () => Promise<{ saved: TSaved[]; total: number }>
  add: (post: TPost) => Promise<{ saved: boolean }>
  remove: (id: string) => Promise<{ saved: boolean }>
  clear: () => Promise<{ saved: boolean }>
}

export interface CreateSavedApiOptions<TPost> {
  /** Names the client, exactly as the app's other API modules do. */
  appName: string
  /** The app's own `saved` endpoint paths. */
  endpoints: SavedEndpoints
  /**
   * The slim record persisted for a post. Keep it small: the saved card is
   * read-only and links back to the live post for anything heavier.
   */
  toSnapshot: (post: TPost) => unknown
}

/**
 * `TSaved` is the app's own saved-item type; the calls never inspect it, so it
 * passes straight through to the caller.
 */
export function createSavedApi<TPost extends { id: string }, TSaved>({
  appName,
  endpoints,
  toSnapshot,
}: CreateSavedApiOptions<TPost>): SavedApi<TPost, TSaved> {
  const client = createAppClient({ appName })

  return {
    list: async () => {
      const response = await client.post<
        Wrapped<{ saved: TSaved[]; total: number }>,
        Record<string, never>
      >(endpoints.list, {})
      const data = unwrap(response)
      return { saved: data?.saved ?? [], total: data?.total ?? 0 }
    },

    add: async (post: TPost) => {
      const response = await client.post<
        Wrapped<{ saved: boolean }>,
        { post: string; data: string }
      >(endpoints.add, {
        post: post.id,
        data: JSON.stringify(toSnapshot(post)),
      })
      return unwrap(response)
    },

    remove: async (id: string) => {
      const response = await client.post<
        Wrapped<{ saved: boolean }>,
        { post: string }
      >(endpoints.remove, { post: id })
      return unwrap(response)
    },

    clear: async () => {
      const response = await client.post<
        Wrapped<{ saved: boolean }>,
        Record<string, never>
      >(endpoints.clear, {})
      return unwrap(response)
    },
  }
}
