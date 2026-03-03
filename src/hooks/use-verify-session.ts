import { useEffect } from 'react'
import { useAuthStore } from '../stores/auth-store'
import { authManager } from '../lib/auth-manager'

/**
 * Hook to proactively re-verify an authenticated session.
 * Runs on load/token changes and on a 30-minute interval.
 */
export function useVerifySession() {
  const token = useAuthStore((state) => state.token)
  const isLogoutInProgress = useAuthStore((state) => state.isLogoutInProgress)

  useEffect(() => {
    // 1. Proactive verification on load/token change.
    if (token && !isLogoutInProgress) {
      authManager.loadIdentity(true)
    }

    // 2. Background check (every 30 mins) if tab stays open
    const interval = setInterval(() => {
      if (token && !isLogoutInProgress) {
        authManager.loadIdentity(true)
      }
    }, 30 * 60 * 1000)

    return () => clearInterval(interval)
  }, [token, isLogoutInProgress])
}
