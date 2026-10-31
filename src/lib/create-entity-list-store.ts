// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: Apache-2.0

// Sidebar list store shared by crm and projects. Each app passes its own list
// call, the key its server answers under, and a failure message as a function,
// so the lingui macro behind it resolves when the failure happens.

import { create } from 'zustand'
import { getErrorMessage } from './handle-server-error'

export interface EntityListStoreState<TRow> {
  rows: TRow[]
  isLoading: boolean
  error: string | null
  /** Whether a load has been asked for since the page opened. */
  started: boolean
  /** Loads the list again, whatever is in flight: for after a change. */
  refresh: () => Promise<void>
  /**
   * Loads the list once for the page: the route loader starts it beside the
   * page's own requests, and the sidebar, which mounts once those have
   * answered, joins it or finds it done rather than asking again. Later
   * changes ask through refresh.
   */
  load: () => Promise<void>
}

export interface EntityListStoreConfig {
  list: () => Promise<{ data?: Record<string, unknown> }>
  /** Key the app's server answers under: `crms`, `projects`. */
  listKey: string
  /** Resolved when a load fails, so each app keeps its own wording. */
  errorMessage: () => string
}

export function createEntityListStore<TRow>({
  list,
  listKey,
  errorMessage,
}: EntityListStoreConfig) {
  let pending: Promise<void> | null = null

  return create<EntityListStoreState<TRow>>()((set, get) => {
    const ask = async () => {
      try {
        const response = await list()
        const rows = (response.data?.[listKey] as TRow[]) ?? []
        set({ rows, isLoading: false })
      } catch (error) {
        set({
          error: getErrorMessage(error, errorMessage()),
          isLoading: false,
        })
      }
    }

    return {
      rows: [],
      isLoading: false,
      error: null,
      started: false,

      refresh: () => {
        set({ isLoading: true, error: null, started: true })
        const request: Promise<void> = ask().finally(() => {
          if (pending === request) pending = null
        })
        pending = request
        return request
      },

      load: () =>
        pending ?? (get().started ? Promise.resolve() : get().refresh()),
    }
  })
}
