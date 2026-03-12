/// <reference path="../types/axios.d.ts" />
import axios, {
  type AxiosError,
  type AxiosRequestConfig,
  type InternalAxiosRequestConfig,
} from 'axios'
import { toast } from './toast-utils'
import { useAuthStore } from '../stores/auth-store'
import { getApiBasepath } from './app-path'
import { isInShell } from './shell-bridge'

const devConsole = globalThis.console
const DEFAULT_TOAST_DEDUPE_TTL_MS = 10_000
const toastDedupeMap = new Map<string, number>()

const logDevError = (message: string, error: unknown) => {
  if (import.meta.env.DEV) {
    devConsole?.error?.(message, error)
  }
}

function getRequestMethod(config?: AxiosRequestConfig): string {
  return config?.method?.toUpperCase() ?? 'UNKNOWN'
}

function getRequestUrl(config?: AxiosRequestConfig): string {
  const base = config?.baseURL ?? ''
  const url = config?.url ?? ''
  return `${base}${url}` || '<unknown>'
}

function shouldShowGlobalErrorToast(config?: AxiosRequestConfig): boolean {
  const explicit = config?.mochi?.showGlobalErrorToast
  if (typeof explicit === 'boolean') {
    return explicit
  }

  const method = config?.method?.toUpperCase()
  if (!method) {
    return true
  }

  // Query-style requests should render inline section errors instead.
  return method !== 'GET' && method !== 'HEAD'
}

function getToastDedupeKey(
  config: AxiosRequestConfig | undefined,
  statusKey: string,
  message: string
): string {
  const customKey = config?.mochi?.toastDedupeKey
  if (customKey) {
    return customKey
  }

  const normalizedMessage = message.trim().toLowerCase()
  return `${getRequestMethod(config)}|${getRequestUrl(config)}|${statusKey}|${normalizedMessage}`
}

function shouldEmitDedupedToast(
  config: AxiosRequestConfig | undefined,
  statusKey: string,
  message: string
): boolean {
  const ttlMs = config?.mochi?.toastDedupeTtlMs ?? DEFAULT_TOAST_DEDUPE_TTL_MS
  const dedupeKey = getToastDedupeKey(config, statusKey, message)
  const now = Date.now()
  const lastShownAt = toastDedupeMap.get(dedupeKey)

  if (lastShownAt !== undefined && now - lastShownAt < ttlMs) {
    return false
  }

  toastDedupeMap.set(dedupeKey, now)

  // Opportunistic cleanup to keep the map bounded.
  if (toastDedupeMap.size > 500) {
    for (const [key, timestamp] of toastDedupeMap.entries()) {
      if (now - timestamp > DEFAULT_TOAST_DEDUPE_TTL_MS * 2) {
        toastDedupeMap.delete(key)
      }
    }
  }

  return true
}

function maybeToastGlobalError({
  config,
  statusKey,
  title,
  description,
}: {
  config?: AxiosRequestConfig
  statusKey: string
  title: string
  description?: string
}): void {
  if (!shouldShowGlobalErrorToast(config)) {
    return
  }

  const dedupeMessage = description ?? title
  if (!shouldEmitDedupedToast(config, statusKey, dedupeMessage)) {
    return
  }

  if (description) {
    toast.error(title, { description })
    return
  }
  toast.error(title)
}

let logoutHandler: ((reason?: string) => void) | null = null

export const setLogoutHandler = (handler: (reason?: string) => void) => {
  logoutHandler = handler
}

export const apiClient = axios.create({
  timeout: 30000,
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
      delete config.headers['Content-Type']
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
    if (token) {
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

apiClient.interceptors.response.use(
  (response) => {
    // Check for application-level errors in successful HTTP responses
    // Some backends return HTTP 200 with error details in the response body
    const responseData = response.data as unknown
    if (
      responseData &&
      typeof responseData === 'object' &&
      'error' in responseData &&
      'status' in responseData
    ) {
      const errorData = responseData as { error?: string; status?: number }
      if (errorData.error && errorData.status && errorData.status >= 400) {
        maybeToastGlobalError({
          config: response.config,
          statusKey: `app-${errorData.status}`,
          title: errorData.error || 'An error occurred',
        })

        if (import.meta.env.DEV) {
          devConsole?.error?.(
            `[API] Application error: ${errorData.error} (status: ${errorData.status})`
          )
        }
      }
    }

    return response
  },
  async (error: AxiosError) => {
    const status = error.response?.status

    switch (status) {
      case 401: {
        logDevError('[API] 401 Unauthorized', error)

        const isAuthEndpoint =
          error.config?.url?.includes('/login') ||
          error.config?.url?.includes('/auth') ||
          error.config?.url?.includes('/verify')

        // Only redirect if user had a session that expired
        // Don't redirect if user was never authenticated (anonymous access)
        const hadSession = useAuthStore.getState().token

        if (!isAuthEndpoint && hadSession) {
          if (logoutHandler) {
            logoutHandler('Session expired')
          } else {
            // Fallback: page reload gets fresh token if session valid
            useAuthStore.getState().clearAuth()
            toast.error('Session expired')
            window.location.reload()
          }
        }

        break
      }

      case 403: {
        // Permission errors are handled by components using isPermissionError()
        logDevError('[API] 403 Forbidden', error)
        break
      }

      case 404: {
        logDevError('[API] 404 Not Found', error)
        break
      }

      case 500: {
        logDevError('[API] Server error', error)
        // Extract error message from backend response
        const responseData = error.response?.data as
          | { error?: string; message?: string }
          | undefined
        const errorMessage =
          responseData?.error ??
          responseData?.message ??
          'An unexpected error occurred'
        maybeToastGlobalError({
          config: error.config,
          statusKey: '500',
          title: 'Server error',
          description: errorMessage,
        })
        if (import.meta.env.DEV) {
          devConsole?.error?.(
            `[API] 500 Error for ${error.config?.method?.toUpperCase()} ${error.config?.baseURL}${error.config?.url}`
          )
          devConsole?.error?.('[API] Response data:', error.response?.data)
        }
        break
      }

      case 502:
      case 503: {
        logDevError('[API] Server error', error)
        const responseData = error.response?.data as
          | { error?: string; message?: string }
          | undefined
        const errorMessage =
          responseData?.error ??
          responseData?.message ??
          'Unable to connect to remote server'
        maybeToastGlobalError({
          config: error.config,
          statusKey: String(status),
          title: 'Server error',
          description: errorMessage,
        })
        break
      }

      default: {
        if (!error.response) {
          // Don't show network error for canceled requests (e.g., page refresh/navigation)
          if (axios.isCancel(error) || error.code === 'ERR_CANCELED') {
            logDevError('[API] Request canceled', error)
          } else {
            logDevError('[API] Network error', error)
            maybeToastGlobalError({
              config: error.config,
              statusKey: 'network',
              title: 'Network error',
              description: 'Please check your internet connection and try again.',
            })
          }
        } else {
          logDevError('[API] Response error', error)
        }
      }
    }

    return Promise.reject(error)
  }
)

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
