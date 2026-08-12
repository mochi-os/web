// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: Apache-2.0

import { Trans, useLingui } from '@lingui/react/macro'
import { Check, Loader2 } from 'lucide-react'
import { Button } from '../ui/button'

interface GameDrawOfferBannerProps {
  opponentName: string
  onAccept: () => void
  onDecline: () => void
  isAccepting: boolean
  isDeclining: boolean
}

export function GameDrawOfferBanner({
  opponentName,
  onAccept,
  onDecline,
  isAccepting,
  isDeclining,
}: GameDrawOfferBannerProps) {
  const { t } = useLingui()
  const disabled = isAccepting || isDeclining

  return (
    <div className='flex items-center justify-between gap-2 rounded-md border bg-muted/50 px-3 py-2'>
      <span className='text-sm font-medium'>
        <Trans>{opponentName} offered a draw</Trans>
      </span>
      <div className='flex items-center gap-2'>
        <Button
          size='sm'
          variant='outline'
          onClick={onDecline}
          disabled={disabled}
        >
          {isDeclining ? (
            <Loader2 className='size-4 animate-spin' />
          ) : (
            t`Decline`
          )}
        </Button>
        <Button size='sm' onClick={onAccept} disabled={disabled}>
          {isAccepting ? (
            <Loader2 className='size-4 animate-spin' />
          ) : (
            <Check className='size-4' />
          )}
          {t`Accept`}
        </Button>
      </div>
    </div>
  )
}
