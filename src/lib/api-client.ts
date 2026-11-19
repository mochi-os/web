// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: Apache-2.0

import { useAuthStore } from '../stores/auth-store'
import { getApiBasepath } from './app-path'
import { isInShell } from './shell-bridge'
import {
  createApiResponseHandlers,
  setLogoutHandler,
} from './api-response-interceptors'
import { mergeHeaders, type HttpError, type HttpRequestConfig } from './http'
import { createHttpClient } from './http-client'
import { Refusal } from './request-path'
import { isSameOriginRequest } from './safe-navigation'

export { setLogoutHandler }

const devConsole = globalThis.console

// Inside the shell, requests go through the shell page (shell-fetch.ts).
export const apiClient = createHttpClient({
  defaults: {
    timeout: 0,
    withCredentials: true,
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
  },
  prepare: (config: HttpRequestConfig) => {
    // Dynamically set baseURL based on current page location
    config.baseURL = getApiBasepath()

    // Handle absolute URLs - they should bypass the app-specific baseURL
    // This includes global auth endpoints (/_/) and cross-app requests (/chat/, /friends/, etc.)
    if (config.url?.startsWith('/')) {
      config.baseURL = ''
    }

    // This server only: no caller means another, and a route parameter that
    // decoded to `//host` would otherwise send the request there and have its
    // answer trusted as this server's.
    if (!isSameOriginRequest(config.baseURL, config.url)) {
      throw new Refusal(
        // eslint-disable-next-line lingui/no-unlocalized-strings -- for developers; normalizeError shows the caller's words
        'Request not sent: the request resolves to another origin'
      )
    }

    // In sandboxed iframe, cookies are unavailable — always use Bearer auth only
    if (isInShell()) {
      config.withCredentials = false
    }

    const token = useAuthStore.getState().token

    if (token && isSameOriginRequest(config.baseURL, config.url)) {
      config.headers = mergeHeaders(config.headers, {
        Authorization: token.startsWith('Bearer ') ? token : `Bearer ${token}`,
      })
    }

    if (import.meta.env.DEV) {
      devConsole?.log?.(`[API] ${config.method?.toUpperCase()} ${config.url}`)
    }

    return config
  },
  handlers: createApiResponseHandlers({
    suppress401Handling: isInShell(),
  }),
})

export function isAuthError(error: unknown): boolean {
  return (
    error instanceof Error &&
    'response' in error &&
    (error as HttpError).response?.status === 401
  )
}

export default apiClient
