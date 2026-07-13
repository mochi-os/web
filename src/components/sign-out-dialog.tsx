// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: Apache-2.0

import { LogOut } from 'lucide-react'
import { useLogout } from '../hooks/use-logout'
import { ConfirmDialog } from './confirm-dialog'
import { t } from '@lingui/core/macro'

interface SignOutDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function SignOutDialog({ open, onOpenChange }: SignOutDialogProps) {
  const { logout, isLoggingOut } = useLogout()

  const handleSignOut = async () => {
    await logout()
    onOpenChange(false)
  }

  return (
    <ConfirmDialog
      open={open}
      onOpenChange={onOpenChange}
      title={t`Log out`}
      desc={t`Are you sure you want to log out? You will need to log in again to access your account.`}
      confirmText={<><LogOut /> {isLoggingOut ? t`Logging out…` : t`Log out`}</>}
      handleConfirm={handleSignOut}
      className='sm:max-w-sm'
      disabled={isLoggingOut}
    />
  )
}
