// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: Apache-2.0

import * as shellStorage from '../lib/shell-storage'

/** Stored in place of an id when the reader last had the "all" view open. */
const ALL = 'all'

export interface LastEntityStorage {
  set: (entityId: string | null) => void
  get: () => Promise<string | null>
  clear: () => void
}

/**
 * Remembers the entity the reader last had open. `null` is the "all" view,
 * stored as a sentinel: an absent key and "the reader chose all" must stay
 * distinguishable. Each app owns its own key.
 */
export function createLastEntityStorage(storageKey: string): LastEntityStorage {
  return {
    set: (entityId: string | null) => {
      shellStorage.setItem(storageKey, entityId ?? ALL)
    },
    get: async (): Promise<string | null> => {
      const value = await shellStorage.getItem(storageKey)
      return value === null || value === ALL ? null : value
    },
    clear: () => {
      shellStorage.removeItem(storageKey)
    },
  }
}
