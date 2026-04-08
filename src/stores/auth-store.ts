import { create } from 'zustand'
import { clearProfileCookie } from '../lib/profile-cookie'
import { initShellBridge, onShellMessage } from '../lib/shell-bridge'
import { getAppPath } from '../lib/app-path'

type TokenResponse = { token?: unknown }

function resolveCurrentAppPath(): string {
  const appPath = getAppPath()
  return appPath.startsWith('/') ? appPath.slice(1) : appPath
}

async function fetchNonShellAppToken(app: string): Promise<string> {
  try {
    const response = await fetch('/_/token', {
      method: 'POST',
      credentials: 'same-origin',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ app }),
    })

    if (!response.ok) {
      return ''
    }

    const data = (await response.json()) as TokenResponse
    return typeof data.token === 'string' ? data.token : ''
  } catch {
    return ''
  }
}

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
  setInitialized: () => void
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

    setInitialized: () => {
      set({ isInitialized: true })
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
      // initShellBridge() handles shell mode (waits for init message)
      // and non-shell mode (returns immediately with empty token).
      const data = await initShellBridge()
      let token = data.token

      // In standalone (non-shell) mode, fetch an app-scoped token from the
      // backend so authenticated API requests include Bearer auth.
      if (!data.inShell && !token) {
        token = await fetchNonShellAppToken(resolveCurrentAppPath())
      }

      set({
        token,
        name: '',
        isAuthenticated: Boolean(token),
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
