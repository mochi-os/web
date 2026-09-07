// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: Apache-2.0

import { create } from 'zustand'
import { clearProfileCookie } from '../lib/profile-cookie'
import { initShellBridge, isInShell, onShellMessage } from '../lib/shell-bridge'
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

// The avatar version token is kept in the top window's localStorage: the avatar
// URL never changes and is cached for five minutes, so a change needs a fresh
// token. Sandboxed iframes have no usable storage; the menus render only there.
function storedAvatar(identity: string): string {
  if (!identity) return ''
  try {
    return localStorage.getItem('avatar:' + identity) ?? ''
  } catch {
    return ''
  }
}

function storeAvatar(identity: string, version: string): void {
  if (!identity) return
  try {
    localStorage.setItem('avatar:' + identity, version)
  } catch {
    // Sandboxed iframe — no storage; the live state still updates.
  }
}

interface AuthState {
  token: string
  identity: string
  name: string
  avatar: string
  isLoading: boolean
  isInitialized: boolean
  isLogoutInProgress: boolean

  isAuthenticated: boolean

  setLoading: (isLoading: boolean) => void
  setToken: (token: string) => void
  setInitialized: () => void
  setProfile: (identity: string, name: string) => void
  setAvatar: (version: string) => void
  startLogoutTransition: () => void
  endLogoutTransition: () => void
  clearAuth: () => void
  initialize: () => Promise<void>
  loadIdentity: (force?: boolean) => Promise<void>
}

// One shell listener per page, however many times initialize() runs.
let listening = false

export const useAuthStore = create<AuthState>()((set, get) => {
  return {
    token: '',
    identity: '',
    name: '',
    avatar: '',
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
      set((state) => ({
        identity,
        name,
        avatar: storedAvatar(identity) || state.avatar,
      }))
    },

    setAvatar: (version) => {
      storeAvatar(get().identity, version)
      set({ avatar: version })
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
        avatar: '',
        isAuthenticated: false,
        isLoading: false,
        isInitialized: true,
      })
    },

    initialize: async () => {
      // Listen before waiting: the bridge gives up after 5 s and resolves
      // with an empty token, but keeps listening, and the shell's init can
      // land after that. Without this the store never learns that token
      // and the app runs anonymous until the next refresh.
      if (isInShell() && !listening) {
        listening = true
        onShellMessage((msg) => {
          if (msg.type !== 'token-refresh' && msg.type !== 'init') return
          if (typeof msg.token !== 'string') return
          set({ token: msg.token, isAuthenticated: Boolean(msg.token) })
        })
      }

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
    },

    // @deprecated Use authManager.loadIdentity() instead
    loadIdentity: async (force?: boolean) => {
      // Delegate to centralized manager to avoid fragmentation
      const { authManager } = await import('../lib/auth-manager')
      await authManager.loadIdentity(force)
    },
  }
})
