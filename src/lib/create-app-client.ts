// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: Apache-2.0

import { getApiBasepath, getAppPath, isDomainEntityRouting } from './app-path'
import { isInShell } from './shell-bridge'
import { useAuthStore } from '../stores/auth-store'
import { createApiResponseHandlers } from './api-response-interceptors'
import {
  buildFullPath,
  isAbsoluteURL,
  mergeHeaders,
  type HttpRequestConfig,
  type HttpResponse,
} from './http'
import { createHttpClient, type HttpMethodConfig } from './http-client'
import { Refusal } from './request-path'
import { isSameOriginRequest } from './safe-navigation'

/* eslint-disable lingui/no-unlocalized-strings -- a caller's fault, shown to developers only (Refusal) */
const refusals = {
  absolute: 'Request not sent: an app client takes a path, not a URL',
  outside: 'Request not sent: the request resolves outside the app',
}
/* eslint-enable lingui/no-unlocalized-strings */

/**
 * Throws unless the request stays with this app. A url carrying an origin of
 * its own (`https://...` or `//host/...`) is refused: a route parameter that
 * decoded to `//host` would otherwise send the request there and have the
 * answer trusted as the app's. The joined request must also resolve on this
 * origin under its baseURL.
 */
function checkInsideApp(config: HttpRequestConfig) {
  if (config.url && isAbsoluteURL(config.url))
    throw new Refusal(refusals.absolute)
  const origin = window.location.origin
  let target: URL
  let base: URL | null = null
  try {
    target = new URL(
      buildFullPath(config.baseURL, config.url),
      document.baseURI
    )
    if (config.baseURL) base = new URL(config.baseURL, document.baseURI)
  } catch {
    throw new Refusal(refusals.outside)
  }
  if (target.origin !== origin) throw new Refusal(refusals.outside)
  if (!base) return
  const prefix = base.pathname.endsWith('/')
    ? base.pathname
    : `${base.pathname}/`
  if (
    base.origin !== origin ||
    (target.pathname !== base.pathname && !target.pathname.startsWith(prefix))
  ) {
    throw new Refusal(refusals.outside)
  }
}

export interface AppClientOptions {
  /**
   * App name, used for the baseURL when getAppPath() supplies none.
   */
  appName?: string
  /**
   * Timeout in milliseconds. Defaults to 30000.
   */
  timeout?: number
}

/**
 * Creates the request client for a Mochi application.
 * This ensures consistent auth token injection and base URL configuration.
 */
export function createAppClient({
  appName,
  timeout = 30000,
}: AppClientOptions = {}) {
  const prepare = (config: HttpRequestConfig): HttpRequestConfig => {
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

    // A leading slash does NOT mean "origin root" here. App endpoint tables
    // write entity paths as `/${id}/-/action`, and buildFullPath combines
    // those onto the app baseURL, which is what they need. Resetting baseURL
    // for them sent every class-level call (`/-/list`) to the origin root,
    // where it matched the SPA catch-all and returned HTML with a 200. Apps
    // reaching core's /_/... endpoints go through apiClient, which applies
    // that rule itself.
    checkInsideApp(config)

    // In sandboxed iframe, cookies are unavailable — always use Bearer auth only
    if (isInShell()) {
      config.withCredentials = false
    }

    // Add auth token
    const token = useAuthStore.getState().token

    if (token && isSameOriginRequest(config.baseURL, config.url)) {
      config.headers = mergeHeaders(config.headers, {
        Authorization: token.startsWith('Bearer ') ? token : `Bearer ${token}`,
      })
    }

    return config
  }

  // Inside the shell, requests go through the shell page (shell-fetch.ts).
  const client = createHttpClient({
    defaults: {
      timeout,
      withCredentials: true,
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
    },
    prepare,
    handlers: createApiResponseHandlers({
      defaultShowGlobalErrorToast: false,
      suppress401Handling: isInShell(),
    }),
  })

  // The methods answer with the response body. request answers with the
  // whole response, for a caller that needs its status or headers.
  return {
    request: <TResponse>(
      config: HttpRequestConfig
    ): Promise<HttpResponse<TResponse>> => client.request<TResponse>(config), // method-ok: the app client itself; the gate scans its callers

    get: async <TResponse>(
      url: string,
      config?: Omit<HttpRequestConfig, 'url' | 'method'>
    ): Promise<TResponse> => {
      const response = await client.get<TResponse>(url, config) // method-ok: the app client itself; the gate scans its callers
      return response.data
    },

    post: async <TResponse, TBody = unknown>(
      url: string,
      data?: TBody,
      config?: HttpMethodConfig<TBody>
    ): Promise<TResponse> => {
      const response = await client.post<TResponse, TBody>(url, data, config)
      return response.data
    },

    put: async <TResponse, TBody = unknown>(
      url: string,
      data?: TBody,
      config?: HttpMethodConfig<TBody>
    ): Promise<TResponse> => {
      const response = await client.put<TResponse, TBody>(url, data, config)
      return response.data
    },

    patch: async <TResponse, TBody = unknown>(
      url: string,
      data?: TBody,
      config?: HttpMethodConfig<TBody>
    ): Promise<TResponse> => {
      const response = await client.patch<TResponse, TBody>(url, data, config)
      return response.data
    },

    delete: async <TResponse>(
      url: string,
      config?: Omit<HttpRequestConfig, 'url' | 'method'>
    ): Promise<TResponse> => {
      const response = await client.delete<TResponse>(url, config)
      return response.data
    },
  }
}

export type AppClient = ReturnType<typeof createAppClient>
