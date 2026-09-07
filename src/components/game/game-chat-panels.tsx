// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: Apache-2.0

// Both chat panels from one prop set. Every game listed the same seven props
// twice, once for the column and once for the sheet, and the pairs drifted:
// only words passed `footer` to both. SheetContent renders through a Radix
// portal, so this can sit where the column belongs and the sheet still opens
// over the page.

import { type FormEvent, type ReactNode } from 'react'
import { GameChatSidebar, GameChatSheet } from './game-chat-panel'

interface GameChatPanelsProps {
  /** Header text. Already translated by the caller. */
  title: ReactNode
  /** The game's own message list, keyed by the caller on the game id. */
  messageList: ReactNode
  newMessage: string
  setNewMessage: (msg: string) => void
  onSendMessage: (e: FormEvent) => void
  isSending: boolean
  sendErrorMessage: string | null
  /** Rendered under the input in both panels. Words puts its composer here. */
  footer?: ReactNode
  /** Visibility and width classes for the column. */
  sidebarClassName?: string
  sheetOpen: boolean
  onSheetOpenChange: (open: boolean) => void
}

export function GameChatPanels({
  sidebarClassName,
  sheetOpen,
  onSheetOpenChange,
  ...panel
}: GameChatPanelsProps) {
  return (
    <>
      <GameChatSidebar className={sidebarClassName} {...panel} />
      <GameChatSheet
        open={sheetOpen}
        onOpenChange={onSheetOpenChange}
        {...panel}
      />
    </>
  )
}
