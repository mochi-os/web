import { create } from 'zustand'
import { clearProfileCookie } from '../lib/profile-cookie'
import { initShellBridge, onShellMessage } from '../lib/shell-bridge'

interface AuthState {
  token: string
  identity: string
  name: string
  isLoading: boolean
  isInitialized: boolean
  isLogoutInProgress: boolean

  isAuthenticated: boolean

  setLoading: (isLoading: boolean) => void
  setToken: (token: string) => void
  setProfile: (identity: string, name: string) => void
  startLogoutTransition: () => void
  endLogoutTransition: () => void
  clearAuth: () => void
  initialize: () => Promise<void>
  loadIdentity: (force?: boolean) => Promise<void>
}

export const useAuthStore = create<AuthState>()((set) => {
  return {
    token: '',
    identity: '',
    name: '',
    isLoading: false,
    isInitialized: false,
    isLogoutInProgress: false,
    isAuthenticated: false,

    setLoading: (isLoading) => {
      set({ isLoading })
    },

    setToken: (token) => {
      set({
        token,
        isAuthenticated: Boolean(token),
      })
    },

    setProfile: (identity, name) => {
      set({ identity, name })
    },

    startLogoutTransition: () => {
      set({ isLogoutInProgress: true })
    },

    endLogoutTransition: () => {
      set({ isLogoutInProgress: false })
    },

    clearAuth: () => {
      clearProfileCookie()

      set({
        token: '',
        identity: '',
        name: '',
        isAuthenticated: false,
        isLoading: false,
        isInitialized: true,
      })
    },

    initialize: async () => {
      // Token is always delivered via postMessage from the shell.
      // initShellBridge() handles both shell mode (waits for init message)
      // and non-shell mode (returns immediately with empty token for public pages).
      const data = await initShellBridge()
      set({
        token: data.token,
        name: data.user?.name || '',
        isAuthenticated: Boolean(data.token),
        isInitialized: true,
        isLogoutInProgress: false,
      })

      // Listen for token refreshes from shell
      if (data.inShell) {
        onShellMessage((msg) => {
          if (msg.type === 'token-refresh' && typeof msg.token === 'string') {
            set({ token: msg.token, isAuthenticated: Boolean(msg.token) })
          }
        })
      }
    },

    // @deprecated Use authManager.loadIdentity() instead
    loadIdentity: async (force?: boolean) => {
      // Delegate to centralized manager to avoid fragmentation
      const { authManager } = await import('../lib/auth-manager')
      await authManager.loadIdentity(force)
    },
  }
})
