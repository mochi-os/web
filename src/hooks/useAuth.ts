import { useAuthStore } from '../stores/auth-store'

export function useAuth() {
  const token = useAuthStore((state) => state.token)
  const identity = useAuthStore((state) => state.identity)
  const name = useAuthStore((state) => state.name)
  const isLoading = useAuthStore((state) => state.isLoading)
  const isLogoutInProgress = useAuthStore((state) => state.isLogoutInProgress)
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated)
  const isInitialized = useAuthStore((state) => state.isInitialized)

  const setLoading = useAuthStore((state) => state.setLoading)
  const setProfile = useAuthStore((state) => state.setProfile)
  const startLogoutTransition = useAuthStore(
    (state) => state.startLogoutTransition
  )
  const endLogoutTransition = useAuthStore((state) => state.endLogoutTransition)

  const initialize = useAuthStore((state) => state.initialize)

  return {
    token,
    identity,
    name,
    isLoading,
    isLogoutInProgress,
    isAuthenticated,
    isInitialized,

    // Actions
    setLoading,
    setProfile,
    startLogoutTransition,
    endLogoutTransition,
    initialize,
    
    logout: async () => {
      const { authManager } = await import('../lib/auth-manager')
      authManager.logout()
    },

    loadIdentity: async (force?: boolean) => {
      const { authManager } = await import('../lib/auth-manager')
      return authManager.loadIdentity(force)
    },
  }
}

export function useIsAuthenticated(): boolean {
  return useAuthStore((state) => state.isAuthenticated)
}

export function useIsAuthLoading(): boolean {
  return useAuthStore((state) => state.isLoading)
}
