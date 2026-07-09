// Copyright © 2026 Mochi OÜ
// SPDX-License-Identifier: Apache-2.0

import axios, {
  type AxiosRequestConfig,
  type InternalAxiosRequestConfig,
} from 'axios'
import { getApiBasepath, getAppPath, isDomainEntityRouting } from './app-path'
import { isInShell } from './shell-bridge'
import { useAuthStore } from '../stores/auth-store'
import { attachApiResponseInterceptors } from './api-response-interceptors'
import { clearContentTypeHeader } from './clear-content-type-header'

export interface AppClientOptions {
  /**
   * The name of the app (e.g., 'chat', 'projects', 'feeds').
   * Used to construct the baseURL if getAppPath() is not used.
   */
  appName?: string
  /**
   * Timeout in milliseconds. Defaults to 30000.
   */
  timeout?: number
}

/**
 * Creates a standardized axios instance for a Mochi application.
 * This ensures consistent auth token injection and base URL configuration.
 */
export function createAppClient({
  appName,
  timeout = 30000,
}: AppClientOptions = {}) {
  const client = axios.create({
    timeout,
    withCredentials: true,
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
  })

  client.interceptors.request.use((config: InternalAxiosRequestConfig) => {
    // If baseURL is not already set and we have an appName or can getAppPath
    if (!config.baseURL) {
      if (isDomainEntityRouting()) {
        // Use the matched route path so subpath-routed domain entities
        // (e.g. acunningham.org/feed) resolve relative endpoints under
        // /feed/, not the domain root.
        const apiBase = getApiBasepath()
        config.baseURL = apiBase.endsWith('/-/')
          ? apiBase.slice(0, -2)
          : apiBase
      } else {
        const appPath = getAppPath()
        if (appPath) {
          config.baseURL = appPath + '/'
        } else if (appName) {
          config.baseURL = `/${appName}/`
        }
      }
    }

    // Remove Content-Type for FormData so axios can set the multipart boundary
    if (config.data instanceof FormData) {
      clearContentTypeHeader(config.headers)
    }

    // In sandboxed iframe, cookies are unavailable — always use Bearer auth only
    if (isInShell()) {
      config.withCredentials = false
    }

    // Add auth token
    const token = useAuthStore.getState().token

    if (token) {
      config.headers.Authorization = token.startsWith('Bearer ')
        ? token
        : `Bearer ${token}`
    }

    return config
  })

  attachApiResponseInterceptors(client, {
    defaultShowGlobalErrorToast: false,
    suppress401Handling: isInShell(),
  })

  // We wrap the client to provide a cleaner async API (returning response.data)
  return {
    instance: client,
    get: async <TResponse>(
      url: string,
      config?: Omit<AxiosRequestConfig, 'url' | 'method'>
    ): Promise<TResponse> => {
      const response = await client.get<TResponse>(url, config)
      return response.data
    },

    post: async <TResponse, TBody = unknown>(
      url: string,
      data?: TBody,
      config?: Omit<AxiosRequestConfig<TBody>, 'url' | 'method' | 'data'>
    ): Promise<TResponse> => {
      const response = await client.post<TResponse>(url, data, config)
      return response.data
    },

    put: async <TResponse, TBody = unknown>(
      url: string,
      data?: TBody,
      config?: Omit<AxiosRequestConfig<TBody>, 'url' | 'method' | 'data'>
    ): Promise<TResponse> => {
      const response = await client.put<TResponse>(url, data, config)
      return response.data
    },

    patch: async <TResponse, TBody = unknown>(
      url: string,
      data?: TBody,
      config?: Omit<AxiosRequestConfig<TBody>, 'url' | 'method' | 'data'>
    ): Promise<TResponse> => {
      const response = await client.patch<TResponse>(url, data, config)
      return response.data
    },

    delete: async <TResponse>(
      url: string,
      config?: Omit<AxiosRequestConfig, 'url' | 'method'>
    ): Promise<TResponse> => {
      const response = await client.delete<TResponse>(url, config)
      return response.data
    },
  }
}

export type AppClient = ReturnType<typeof createAppClient>
