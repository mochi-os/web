// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: Apache-2.0

// The two confirmations every game ends with. Chess and go had them
// byte-identical; words differed on one line, since it has no single opponent
// to name in the resign warning. `opponentName` is optional for that, and both
// wordings are the ones those apps shipped.
//
// The strings live here rather than in each app: this is the one shared game
// file that carries lingui macros, so these msgids reach every app's catalogs.

import { Loader2 } from 'lucide-react'
import { Trans, useLingui } from '@lingui/react/macro'
import { ConfirmDialog } from '../confirm-dialog'

interface GameEndDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: () => void
  isPending: boolean
}

export function GameResignDialog({
  open,
  onOpenChange,
  onConfirm,
  isPending,
  opponentName,
}: GameEndDialogProps & { opponentName?: string }) {
  const { t } = useLingui()
  return (
    <ConfirmDialog
      open={open}
      onOpenChange={onOpenChange}
      title={t`Resign game?`}
      desc={
        opponentName
          ? t`Are you sure you want to resign? ${opponentName} will win the game.`
          : t`Are you sure you want to resign?`
      }
      confirmText={
        isPending ? (
          <>
            <Loader2 className='me-2 size-4 animate-spin' />
            <Trans>Resigning...</Trans>
          </>
        ) : (
          t`Resign`
        )
      }
      destructive
      handleConfirm={onConfirm}
      isLoading={isPending}
    />
  )
}

export function GameDeleteDialog({
  open,
  onOpenChange,
  onConfirm,
  isPending,
}: GameEndDialogProps) {
  const { t } = useLingui()
  return (
    <ConfirmDialog
      open={open}
      onOpenChange={onOpenChange}
      title={t`Delete game?`}
      desc={t`This permanently deletes the game and its chat. This cannot be undone.`}
      confirmText={
        isPending ? (
          <>
            <Loader2 className='me-2 size-4 animate-spin' />
            <Trans>Deleting...</Trans>
          </>
        ) : (
          t`Delete`
        )
      }
      destructive
      handleConfirm={onConfirm}
      isLoading={isPending}
    />
  )
}
