import { useCallback } from 'react'
import { toast } from '../lib/toast-utils'
import { useAuth } from './useAuth'
import { authManager } from '../lib/auth-manager'

export function useLogout() {
  const { isLogoutInProgress } = useAuth()

  const logout = useCallback(async () => {
    try {
      await authManager.logout()
      toast.success('Logged out successfully')
    } catch (_error) {
      toast.error('Logged out (with errors)')
      await authManager.logout('Force logout after error')
    }
  }, [])

  return {
    logout,
    isLoggingOut: isLogoutInProgress,
  }
}
