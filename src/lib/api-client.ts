/// <reference path="../types/axios.d.ts" />
// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: Apache-2.0

import axios, {
  type AxiosError,
  type InternalAxiosRequestConfig,
} from 'axios'
import { useAuthStore } from '../stores/auth-store'
import { getApiBasepath } from './app-path'
import { isInShell } from './shell-bridge'
import {
  attachApiResponseInterceptors,
  setLogoutHandler,
} from './api-response-interceptors'
import { clearContentTypeHeader } from './clear-content-type-header'
import { isSameOriginRequest } from './safe-navigation'

export { setLogoutHandler }

const devConsole = globalThis.console

const logDevError = (message: string, error: unknown) => {
  if (import.meta.env.DEV) {
    devConsole?.error?.(message, error)
  }
}

export const apiClient = axios.create({
  timeout: 0,
  withCredentials: true,
  headers: {
    Accept: 'application/json',
    'Content-Type': 'application/json',
  },
})

apiClient.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    // Dynamically set baseURL based on current page location
    config.baseURL = getApiBasepath()

    // Remove Content-Type for FormData so axios can set the multipart boundary
    if (config.data instanceof FormData) {
      clearContentTypeHeader(config.headers)
    }

    // Handle absolute URLs - they should bypass the app-specific baseURL
    // This includes global auth endpoints (/_/) and cross-app requests (/chat/, /friends/, etc.)
    if (config.url?.startsWith('/')) {
      config.baseURL = ''
    }

    // In sandboxed iframe, cookies are unavailable — always use Bearer auth only
    if (isInShell()) {
      config.withCredentials = false
    }

    const token = useAuthStore.getState().token

    config.headers = config.headers ?? {}
    if (token && isSameOriginRequest(config.baseURL, config.url)) {
      ;(config.headers as Record<string, string>).Authorization =
        token.startsWith('Bearer ') ? token : `Bearer ${token}`
    }

    if (import.meta.env.DEV) {
      devConsole?.log?.(`[API] ${config.method?.toUpperCase()} ${config.url}`)
    }

    return config
  },
  (error) => {
    logDevError('[API] Request error', error)
    return Promise.reject(error)
  }
)

attachApiResponseInterceptors(apiClient, {
  suppress401Handling: isInShell(),
})

export function isAuthError(error: unknown): boolean {
  return (
    error instanceof Error &&
    'response' in error &&
    (error as AxiosError).response?.status === 401
  )
}

export function isForbiddenError(error: unknown): boolean {
  return (
    error instanceof Error &&
    'response' in error &&
    (error as AxiosError).response?.status === 403
  )
}

export function isNetworkError(error: unknown): boolean {
  return (
    error instanceof Error &&
    'response' in error &&
    !(error as AxiosError).response
  )
}

export default apiClient
