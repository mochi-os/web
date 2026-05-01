import { useCallback } from 'react'
import { useLingui } from '@lingui/react/macro'
import { toast } from '../lib/toast-utils'
import { useAuth } from './useAuth'
import { authManager } from '../lib/auth-manager'

export function useLogout() {
  const { t } = useLingui()
  const { isLogoutInProgress } = useAuth()

  const logout = useCallback(async () => {
    try {
      await authManager.logout()
      toast.success(t`Logged out successfully`)
    } catch (_error) {
      toast.error(t`Logged out (with errors)`)
      await authManager.logout('Force logout after error')
    }
  }, [])

  return {
    logout,
    isLoggingOut: isLogoutInProgress,
  }
}
