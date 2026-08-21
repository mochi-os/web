// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: Apache-2.0

import { useEffect } from 'react'
import { useAuthStore } from '../stores/auth-store'
import { authManager } from '../lib/auth-manager'

export function useVerifySession(enabled: boolean = true) {
  const token = useAuthStore((state) => state.token)
  const isLogoutInProgress = useAuthStore((state) => state.isLogoutInProgress)

  useEffect(() => {
    // The identity load always runs, so the auth store has the user's name.
    // Only the 30-minute re-check is gated on `enabled`: shell mode handles
    // session validity itself.
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
