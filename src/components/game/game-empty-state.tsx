// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: Apache-2.0

import { Plus, type LucideIcon } from 'lucide-react'
import { Trans, useLingui } from '@lingui/react/macro'
import { Button } from '../ui/button'
import { EmptyState } from '../ui/empty-state'
import { getAppPath } from '../../lib/app-path'

interface GameEmptyStateProps {
  onNewGame: () => void
  hasExistingGames: boolean
  /**
   * Defaults to the calling app's own `images/icon.svg`.
   */
  icon?: LucideIcon | string
}

export function GameEmptyState({
  onNewGame,
  hasExistingGames,
  icon,
}: GameEmptyStateProps) {
  const { t } = useLingui()
  // Resolved during render, not at import: the app path arrives from the shell
  // asynchronously.
  const gameIcon = icon ?? `${getAppPath()}/images/icon.svg`

  if (hasExistingGames) {
    return (
      <div className='flex h-full w-full flex-1 flex-col items-center justify-center'>
        <EmptyState
          icon={gameIcon}
          title={t`Select a game`}
          description={t`Choose a game from the sidebar or start a new one.`}
        >
          <Button onClick={onNewGame} variant='outline'>
            <Plus className='size-4' />
            <Trans>New game</Trans>
          </Button>
        </EmptyState>
      </div>
    )
  }

  return (
    <div className='flex h-full w-full flex-1 flex-col items-center justify-center'>
      <EmptyState icon={gameIcon} title={t`No games yet`} description=''>
        <Button size='lg' onClick={onNewGame}>
          <Plus className='size-5' />
          <Trans>New game</Trans>
        </Button>
      </EmptyState>
    </div>
  )
}
