// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: Apache-2.0

import {
  createContext,
  useContext,
  useState,
  useCallback,
  type ReactNode,
} from 'react'

// Named EntitySidebar rather than Sidebar: the shadcn SidebarProvider in
// components/ui/sidebar.tsx already owns that name, and the two are unrelated.
// The game apps have their own GameSidebarProvider next door, which carries
// websocket state this one has no use for.
type EntitySidebarContextValue = {
  createDialogOpen: boolean
  openCreateDialog: () => void
  closeCreateDialog: () => void
}

const EntitySidebarContext = createContext<EntitySidebarContextValue | null>(
  null
)

/** Owns the "create entity" dialog for the crm and projects sidebars. */
export function EntitySidebarProvider({ children }: { children: ReactNode }) {
  const [createDialogOpen, setCreateDialogOpen] = useState(false)

  const openCreateDialog = useCallback(() => setCreateDialogOpen(true), [])
  const closeCreateDialog = useCallback(() => setCreateDialogOpen(false), [])

  return (
    <EntitySidebarContext.Provider
      value={{ createDialogOpen, openCreateDialog, closeCreateDialog }}
    >
      {children}
    </EntitySidebarContext.Provider>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export function useEntitySidebarContext() {
  const context = useContext(EntitySidebarContext)
  if (!context) {
    throw new Error(
      'useEntitySidebarContext must be used within an EntitySidebarProvider'
    )
  }
  return context
}
