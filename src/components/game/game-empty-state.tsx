// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: Apache-2.0

import type { LucideIcon } from 'lucide-react'
import { Trans, useLingui } from '@lingui/react/macro'
import { Plus } from 'lucide-react'
import { Button } from '../ui/button'
import { EmptyState } from '../ui/empty-state'

interface GameEmptyStateProps {
  onNewGame: () => void
  hasExistingGames: boolean
  /** Per-game icon: chess uses Swords, go uses Circle, words uses LetterText. */
  icon: LucideIcon
}

export function GameEmptyState({
  onNewGame,
  hasExistingGames,
  icon,
}: GameEmptyStateProps) {
  const { t } = useLingui()

  if (hasExistingGames) {
    return (
      <div className='flex h-full w-full flex-1 flex-col items-center justify-center'>
        <EmptyState
          icon={icon}
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
      <EmptyState icon={icon} title={t`No games yet`} description=''>
        <Button size='lg' onClick={onNewGame}>
          <Plus className='size-5' />
          <Trans>New game</Trans>
        </Button>
      </EmptyState>
    </div>
  )
}
