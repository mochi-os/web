// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: Apache-2.0

import { useEffect, useMemo, type ReactNode } from 'react'
import { useAuthStore } from '../stores/auth-store'
import {
  ChatWebsocketManager,
  type ChatWebsocketManagerOptions,
} from '../lib/realtime-websocket-manager'
import { GameWebsocketContext } from './game-websocket-context'

interface GameWebsocketProviderProps {
  children: ReactNode
  /**
   * Resolves the chat key for a game. Each game app fetches this from its own
   * games endpoint, so the lookup is injected rather than imported. May throw —
   * the provider catches and degrades to an unkeyed connection.
   */
  getGameKey: (gameId: string) => Promise<string | undefined>
}

const buildManager = (
  getGameKey: GameWebsocketProviderProps['getGameKey']
): ChatWebsocketManager | null => {
  if (typeof window === 'undefined') {
    return null
  }

  const baseOptions: ChatWebsocketManagerOptions = {
    baseUrl: import.meta.env.VITE_WEBSOCKET_URL ?? window.location.origin,
    getToken: () => useAuthStore.getState().token,
    getChatKey: async (gameId: string) => {
      try {
        return await getGameKey(gameId)
      } catch (error) {
        if (import.meta.env.DEV) {
          /* eslint-disable lingui/no-unlocalized-strings -- dev-only diagnostic log, not user-facing */
          globalThis.console?.error?.(
            '[WebSocket] Failed to fetch game key',
            gameId,
            error
          )
          /* eslint-enable lingui/no-unlocalized-strings */
        }
        return undefined
      }
    },
  }

  return new ChatWebsocketManager(baseOptions)
}

export const GameWebsocketProvider = ({
  children,
  getGameKey,
}: GameWebsocketProviderProps) => {
  // Built once per mount, as before. getGameKey is deliberately not a dependency:
  // apps pass an inline arrow, so tracking it would tear down and rebuild the
  // socket on every render.
  const manager = useMemo(() => buildManager(getGameKey), []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    return () => {
      manager?.dispose()
    }
  }, [manager])

  return (
    <GameWebsocketContext.Provider value={manager}>
      {children}
    </GameWebsocketContext.Provider>
  )
}
