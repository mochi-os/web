// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: Apache-2.0

// The in-game chat panel shared by chess, go and words, in both the shapes
// the games use it: a desktop column and a mobile sheet. The message list is
// a slot because each game wraps GameChatMessageList with its own move
// wording. The title is a prop so no Lingui string lives in lib/web, where it
// would be extracted into every app's catalogs.

import { type FormEvent, type ReactNode } from 'react'
import { GameChatInput } from './game-chat-input'
import {
  SidePanel,
  SidePanelFooter,
  SidePanelHeader,
  SidePanelTitle,
} from '../ui/side-panel'
import { cn } from '../../lib/utils'

interface GameChatPanelBaseProps {
  /** Header text. Already translated by the caller. */
  title: ReactNode
  /** The game's own message list, keyed by the caller on the game id. */
  messageList: ReactNode
  newMessage: string
  setNewMessage: (msg: string) => void
  onSendMessage: (e: FormEvent) => void
  isSending: boolean
  sendErrorMessage: string | null
  /** Rendered under the input. Words puts its move composer here. */
  footer?: ReactNode
}

interface GameChatSidebarProps extends GameChatPanelBaseProps {
  /** Visibility and width classes. The games differ on the breakpoint. */
  className?: string
}

interface GameChatSheetProps extends GameChatPanelBaseProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

type ChatComposerProps = Omit<GameChatPanelBaseProps, 'title' | 'messageList'>

function ChatComposer({
  newMessage,
  setNewMessage,
  onSendMessage,
  isSending,
  sendErrorMessage,
  footer,
}: ChatComposerProps) {
  return (
    <>
      <GameChatInput
        newMessage={newMessage}
        setNewMessage={setNewMessage}
        onSendMessage={onSendMessage}
        isSending={isSending}
        errorMessage={sendErrorMessage}
      />
      {footer}
    </>
  )
}

function ChatPanelBody({
  messageList,
  ...composer
}: Omit<GameChatPanelBaseProps, 'title'>) {
  return (
    <>
      {messageList}
      <ChatComposer {...composer} />
    </>
  )
}

export function GameChatSidebar({
  title,
  className,
  ...body
}: GameChatSidebarProps) {
  return (
    // No display class in the base: the caller passes `hidden lg:flex` plus
    // its width, and the column is laid out by whatever it gives.
    <div className={cn('flex-col border-s', className)}>
      <div className='border-b px-3 py-2'>
        <h3 className='text-sm font-medium'>{title}</h3>
      </div>
      <ChatPanelBody {...body} />
    </div>
  )
}

export function GameChatSheet({
  title,
  open,
  onOpenChange,
  messageList,
  ...composer
}: GameChatSheetProps) {
  return (
    <SidePanel
      open={open}
      onOpenChange={onOpenChange}
      size='sm'
      onOpenAutoFocus={(event) => event.preventDefault()}
    >
      <SidePanelHeader>
        <SidePanelTitle>{title}</SidePanelTitle>
      </SidePanelHeader>
      {messageList}
      {/* The composer is the footer. The input carries its own padding, so
          the footer only adds the rule above it. */}
      <SidePanelFooter className='gap-0 p-0 pt-2'>
        <ChatComposer {...composer} />
      </SidePanelFooter>
    </SidePanel>
  )
}
