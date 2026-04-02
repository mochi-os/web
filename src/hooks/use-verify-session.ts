import { useEffect } from 'react'
import { useAuthStore } from '../stores/auth-store'
import { authManager } from '../lib/auth-manager'

/**
 * Hook to proactively re-verify an authenticated session.
 * Runs on load/token changes and on a 30-minute interval.
 * @param enabled - Set to false to skip verification (e.g., in shell mode)
 */
export function useVerifySession(enabled: boolean = true) {
  const token = useAuthStore((state) => state.token)
  const isLogoutInProgress = useAuthStore((state) => state.isLogoutInProgress)

  useEffect(() => {
    if (!enabled) return

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
  }, [token, isLogoutInProgress, enabled])
}
