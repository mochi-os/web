import { LogOut } from 'lucide-react'
import { useLingui } from '@lingui/react/macro'
import { useLogout } from '../hooks/use-logout'
import { ConfirmDialog } from './confirm-dialog'

interface SignOutDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function SignOutDialog({ open, onOpenChange }: SignOutDialogProps) {
  const { t } = useLingui()
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
      desc='Are you sure you want to log out? You will need to log in again to access your account.'
      confirmText={<><LogOut /> {isLoggingOut ? 'Logging out...' : 'Log out'}</>}
      handleConfirm={handleSignOut}
      className='sm:max-w-sm'
      disabled={isLoggingOut}
    />
  )
}
