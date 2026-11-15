// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: Apache-2.0

import { useCallback, useContext, useSyncExternalStore } from 'react'
import { GameWebsocketContext } from '../context/game-websocket-context'

export const useGameWebsocketManager = () => {
  return useContext(GameWebsocketContext)
}

/**
 * Whether a game socket the page is subscribed to is open, kept current as
 * sockets open, drop and are let go. False with no manager.
 */
export const useGameWebsocketReady = (): boolean => {
  const manager = useGameWebsocketManager()
  const watch = useCallback(
    (changed: () => void) => (manager ? manager.watch(changed) : () => {}),
    [manager]
  )
  return useSyncExternalStore(
    watch,
    () => manager?.ready() ?? false,
    () => false
  )
}
