import { create } from 'zustand'
import { removeCookie, getCookie } from '../lib/cookies'
import { clearProfileCookie, readProfileCookie } from '../lib/profile-cookie'


const TOKEN_COOKIE = 'token'

interface AuthState {
  token: string
  identity: string
  name: string
  isLoading: boolean
  isInitialized: boolean
  isLogoutInProgress: boolean

  isAuthenticated: boolean

  setLoading: (isLoading: boolean) => void
  setProfile: (identity: string, name: string) => void
  startLogoutTransition: () => void
  endLogoutTransition: () => void
  clearAuth: () => void
  initialize: () => void
  loadIdentity: (force?: boolean) => Promise<void>
}

export const useAuthStore = create<AuthState>()((set, get) => {
  const initialToken = getCookie(TOKEN_COOKIE) || ''

  return {
    token: initialToken,
    identity: '',
    name: '',
    isLoading: false,
    isInitialized: false,
    isLogoutInProgress: false,
    isAuthenticated: Boolean(initialToken),

    setLoading: (isLoading) => {
      set({ isLoading })
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
      removeCookie(TOKEN_COOKIE)
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

    initialize: () => {
      const cookieToken = getCookie(TOKEN_COOKIE) || ''
      const storeToken = get().token
      const profile = readProfileCookie()
      const profileName = profile.name || ''

      if (cookieToken !== storeToken) {
        set({
          token: cookieToken,
          identity: '',
          name: cookieToken ? profileName : '',
          isAuthenticated: Boolean(cookieToken),
          isInitialized: true,
          isLogoutInProgress: false,
        })
      } else {
        set({
          identity: cookieToken ? get().identity : '',
          name: cookieToken ? profileName : '',
          isInitialized: true,
          isLogoutInProgress: false,
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
