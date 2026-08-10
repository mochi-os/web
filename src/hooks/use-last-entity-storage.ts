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
 * Remembers the entity the reader last had open, so the app can restore it on
 * launch. `null` means the "all" view, which is stored as a sentinel rather
 * than as an absent key: an absent key and "the reader chose all" have to stay
 * distinguishable for the launch route to pick the right screen.
 *
 * Each app owns its own key — they must not share one, or opening feeds would
 * move the reader's last forum. This is the entity-app counterpart of
 * createLastGameStorage, which has no "all" view and so needs no sentinel.
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
