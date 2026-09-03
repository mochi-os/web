// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: Apache-2.0

// Fixture strings only. No lingui macro in this file: every app's
// lingui.config.js scans lib/web/src/**, so fixtures would be extracted.

import type { ReactElement, ReactNode } from 'react'
import { describe, it, expect, vi } from 'vitest'
import {
  render as rtlRender,
  screen,
  fireEvent,
} from '@testing-library/react'
import { i18n } from '@lingui/core'
import { I18nProvider } from '@lingui/react'
import { GameChatSidebar, GameChatSheet } from './game-chat-panel'

// The input renders under useLingui, so the tree needs the provider. The
// locale itself is activated globally in src/test/setup.ts.
function render(ui: ReactElement) {
  return rtlRender(ui, {
    wrapper: ({ children }: { children: ReactNode }) => (
      <I18nProvider i18n={i18n}>{children}</I18nProvider>
    ),
  })
}

const base = {
  title: 'Chat',
  messageList: <div data-testid='messages'>messages</div>,
  newMessage: '',
  setNewMessage: vi.fn(),
  onSendMessage: vi.fn(),
  isSending: false,
  sendErrorMessage: null,
}

describe('GameChatSidebar', () => {
  it('renders the title, the message list slot and the input', () => {
    render(<GameChatSidebar {...base} />)

    expect(screen.getByText('Chat')).toBeInTheDocument()
    expect(screen.getByTestId('messages')).toBeInTheDocument()
    expect(screen.getByRole('textbox')).toBeInTheDocument()
  })

  it('keeps the caller breakpoint classes on the column', () => {
    const { container } = render(
      <GameChatSidebar {...base} className='hidden md:flex' />
    )

    expect(container.firstChild).toHaveClass('hidden')
    expect(container.firstChild).toHaveClass('md:flex')
    expect(container.firstChild).toHaveClass('border-s')
    expect(container.firstChild).toHaveClass('flex-col')
  })

  it('renders the footer slot after the input when one is given', () => {
    render(<GameChatSidebar {...base} footer={<div>composer</div>} />)

    expect(screen.getByText('composer')).toBeInTheDocument()
  })

  it('renders no footer element when none is given', () => {
    render(<GameChatSidebar {...base} />)

    expect(screen.queryByText('composer')).not.toBeInTheDocument()
  })

  it('sends the typed message', () => {
    const onSendMessage = vi.fn((e: { preventDefault: () => void }) =>
      e.preventDefault()
    )
    render(
      <GameChatSidebar
        {...base}
        newMessage='hello'
        onSendMessage={onSendMessage}
      />
    )

    fireEvent.click(screen.getByRole('button'))

    expect(onSendMessage).toHaveBeenCalledTimes(1)
  })
})

describe('GameChatSheet', () => {
  it('renders its content when open', () => {
    render(<GameChatSheet {...base} open onOpenChange={vi.fn()} />)

    expect(screen.getByText('Chat')).toBeInTheDocument()
    expect(screen.getByTestId('messages')).toBeInTheDocument()
  })

  it('renders nothing when closed', () => {
    render(<GameChatSheet {...base} open={false} onOpenChange={vi.fn()} />)

    expect(screen.queryByTestId('messages')).not.toBeInTheDocument()
  })

  it('renders the footer slot when open', () => {
    render(
      <GameChatSheet
        {...base}
        open
        onOpenChange={vi.fn()}
        footer={<div>composer</div>}
      />
    )

    expect(screen.getByText('composer')).toBeInTheDocument()
  })
})
