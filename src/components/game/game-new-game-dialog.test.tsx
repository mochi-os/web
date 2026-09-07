// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: Apache-2.0

// Fixture strings only. No lingui macro in this file: every app's
// lingui.config.js scans lib/web/src/**, so fixtures would be extracted.

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { i18n } from '@lingui/core'
import { I18nProvider } from '@lingui/react'
import type { ReactElement, ReactNode } from 'react'
import {
  GameNewGameDialog,
  type GameNewGameDialogLabels,
} from './game-new-game-dialog'

const shellNavigateExternal = vi.fn()
vi.mock('../../lib/shell-bridge', () => ({
  shellNavigateExternal: (path: string) => shellNavigateExternal(path),
}))

// The picker pulls in cmdk and a query client. Only its props matter here.
const pickerProps = vi.fn()
vi.mock('../person-picker', () => ({
  PersonPicker: (props: Record<string, unknown>) => {
    pickerProps(props)
    return <div data-testid='picker' />
  },
}))

function renderDialog(ui: ReactElement) {
  return render(ui, {
    wrapper: ({ children }: { children: ReactNode }) => (
      <I18nProvider i18n={i18n}>{children}</I18nProvider>
    ),
  })
}

const labels: GameNewGameDialogLabels = {
  title: 'New game',
  description: 'Start a new test game',
  opponentLabel: 'Choose opponent',
  emptyTitle: 'No friends yet',
  emptyHint: 'Add friends in the People app to start playing',
  addFriends: 'Add friends',
  placeholder: 'Select a friend...',
  emptyMessage: 'No friends found',
  cancel: 'Cancel',
  submit: 'Start game',
  submitting: 'Creating...',
}

const base = {
  open: true,
  onOpenChange: vi.fn(),
  friends: [{ id: 'f1', name: 'Ana' }],
  isLoading: false,
  error: null,
  onRetry: vi.fn(),
  mode: 'single' as const,
  value: '',
  onChange: vi.fn(),
  canSubmit: false,
  isSubmitting: false,
  onSubmit: vi.fn(),
  labels,
}

describe('GameNewGameDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('shows a skeleton while the friends load', () => {
    renderDialog(<GameNewGameDialog {...base} isLoading friends={[]} />)

    expect(screen.queryByTestId('picker')).not.toBeInTheDocument()
    expect(document.querySelector('[data-slot="skeleton"]')).toBeTruthy()
  })

  it('shows the empty state when there are no friends', () => {
    renderDialog(<GameNewGameDialog {...base} friends={[]} />)

    expect(screen.getByText('No friends yet')).toBeInTheDocument()
    expect(screen.queryByTestId('picker')).not.toBeInTheDocument()
  })

  it('sends the viewer to the people app from the empty state', () => {
    renderDialog(<GameNewGameDialog {...base} friends={[]} />)

    fireEvent.click(screen.getByText('Add friends'))

    expect(shellNavigateExternal).toHaveBeenCalledWith('/people/?action=add')
  })

  it('renders the picker once friends have arrived', () => {
    renderDialog(<GameNewGameDialog {...base} />)

    expect(screen.getByTestId('picker')).toBeInTheDocument()
    expect(pickerProps).toHaveBeenCalledWith(
      expect.objectContaining({
        mode: 'single',
        local: base.friends,
        placeholder: 'Select a friend...',
        emptyMessage: 'No friends found',
      })
    )
  })

  it('renders the options slot and the picker footer', () => {
    renderDialog(
      <GameNewGameDialog
        {...base}
        options={<div>board size</div>}
        pickerFooter={<div>2 players</div>}
      />
    )

    expect(screen.getByText('board size')).toBeInTheDocument()
    expect(screen.getByText('2 players')).toBeInTheDocument()
  })

  it('keeps submit disabled until the caller allows it', () => {
    renderDialog(<GameNewGameDialog {...base} />)

    expect(screen.getByText('Start game').closest('button')).toBeDisabled()
  })

  it('submits when the caller allows it', () => {
    const onSubmit = vi.fn()
    renderDialog(<GameNewGameDialog {...base} canSubmit onSubmit={onSubmit} />)

    fireEvent.click(screen.getByText('Start game'))

    expect(onSubmit).toHaveBeenCalledTimes(1)
  })

  it('shows the submitting label while the mutation runs', () => {
    renderDialog(<GameNewGameDialog {...base} canSubmit isSubmitting />)

    expect(screen.getByText('Creating...')).toBeInTheDocument()
    expect(screen.queryByText('Start game')).not.toBeInTheDocument()
  })

  it('closes from the cancel button', () => {
    const onOpenChange = vi.fn()
    renderDialog(<GameNewGameDialog {...base} onOpenChange={onOpenChange} />)

    fireEvent.click(screen.getByText('Cancel'))

    expect(onOpenChange).toHaveBeenCalledWith(false)
  })
})
