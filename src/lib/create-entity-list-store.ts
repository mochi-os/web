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
  refresh: () => Promise<void>
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
  return create<EntityListStoreState<TRow>>()((set) => ({
    rows: [],
    isLoading: false,
    error: null,

    refresh: async () => {
      set({ isLoading: true, error: null })
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
    },
  }))
}
