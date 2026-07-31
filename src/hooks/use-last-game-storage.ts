// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: Apache-2.0

import * as shellStorage from '../lib/shell-storage'

export interface LastGameStorage {
  setLastGame: (gameId: string) => void
  getLastGame: () => Promise<string | null>
  clearLastGame: () => void
}

/**
 * Remembers the game a player last had open, so the app can restore it on
 * launch. Each game app owns its own key — they must not share one, or opening
 * chess would move the player's last go game.
 */
export function createLastGameStorage(storageKey: string): LastGameStorage {
  return {
    setLastGame: (gameId: string) => {
      shellStorage.setItem(storageKey, gameId)
    },
    getLastGame: async (): Promise<string | null> => {
      return shellStorage.getItem(storageKey)
    },
    clearLastGame: () => {
      shellStorage.removeItem(storageKey)
    },
  }
}
