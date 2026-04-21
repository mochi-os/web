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
    // Always load the identity once on mount so the auth store has the user's
    // name available (needed by menu header, optimistic UI, etc.). The periodic
    // background re-check is gated on `enabled` — shell mode handles session
    // validity itself and doesn't need the 30-min poll.
    if (token && !isLogoutInProgress) {
      authManager.loadIdentity(false)
    }

    if (!enabled) return

    const interval = setInterval(() => {
      if (token && !isLogoutInProgress) {
        authManager.loadIdentity(true)
      }
    }, 30 * 60 * 1000)

    return () => clearInterval(interval)
  }, [token, isLogoutInProgress, enabled])
}
