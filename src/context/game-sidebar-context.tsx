// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: Apache-2.0

import {
  createContext,
  useContext,
  useState,
  useCallback,
  type ReactNode,
} from 'react'
import { getWebsocketStatusMeta, type WebsocketStatusMeta } from '../lib/chat-ui'
import type { WebsocketConnectionStatus } from '../lib/realtime-websocket-manager'

// Named GameSidebar rather than Sidebar: the shadcn SidebarProvider in
// components/ui/sidebar.tsx already owns that name, and the two are unrelated.
type GameSidebarContextValue = {
  gameId: string | null
  setGame: (id: string | null) => void
  newGameDialogOpen: boolean
  openNewGameDialog: () => void
  closeNewGameDialog: () => void
  websocketStatus: WebsocketConnectionStatus
  websocketStatusMeta: WebsocketStatusMeta
  setWebsocketStatus: (
    status: WebsocketConnectionStatus,
    retries?: number
  ) => void
}

const GameSidebarContext = createContext<GameSidebarContextValue | null>(null)

export function GameSidebarProvider({ children }: { children: ReactNode }) {
  const [gameId, setGameId] = useState<string | null>(null)
  const [newGameDialogOpen, setNewGameDialogOpen] = useState(false)
  const [websocketStatus, setWsStatus] =
    useState<WebsocketConnectionStatus>('idle')
  const [websocketRetries, setWebsocketRetries] = useState(0)

  const setGame = useCallback((id: string | null) => {
    setGameId(id)
  }, [])

  const openNewGameDialog = useCallback(() => {
    setNewGameDialogOpen(true)
  }, [])

  const closeNewGameDialog = useCallback(() => {
    setNewGameDialogOpen(false)
  }, [])

  const setWebsocketStatus = useCallback(
    (status: WebsocketConnectionStatus, retries = 0) => {
      setWsStatus(status)
      setWebsocketRetries(retries)
    },
    []
  )

  const websocketStatusMeta = getWebsocketStatusMeta(
    websocketStatus,
    websocketRetries
  )

  return (
    <GameSidebarContext.Provider
      value={{
        gameId,
        setGame,
        newGameDialogOpen,
        openNewGameDialog,
        closeNewGameDialog,
        websocketStatus,
        websocketStatusMeta,
        setWebsocketStatus,
      }}
    >
      {children}
    </GameSidebarContext.Provider>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export function useGameSidebarContext() {
  const context = useContext(GameSidebarContext)
  if (!context) {
    throw new Error(
      'useGameSidebarContext must be used within a GameSidebarProvider'
    )
  }
  return context
}
