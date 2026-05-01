// Shared QueryClient factory with sensible defaults to prevent caching issues
import { QueryCache, QueryClient } from '@tanstack/react-query'
import { AxiosError } from 'axios'
import { t } from '@lingui/core/macro'
import { ApiError } from './request'
import { toast } from './toast-utils'

export interface CreateQueryClientOptions {
  /**
   * @deprecated No-op. Previously navigated to /500 on query errors, but this
   * prevented section-scoped error display. 5xx errors now show an inline
   * GeneralError within the section that owns the query. The /500 page is
   * still reachable via explicit throws in TanStack Router loaders. This field
   * will be removed in a future cleanup.
   */
  onServerError?: () => void
  onForbidden?: () => void
}

const MAX_QUERY_RETRIES_PROD = 1
const NON_RETRYABLE_STATUSES = new Set([401, 403, 404])

function getErrorStatus(error: unknown): number | undefined {
  if (error instanceof AxiosError) {
    return error.response?.status
  }
  if (error instanceof ApiError) {
    return error.status
  }
  if (error && typeof error === 'object') {
    const anyError = error as {
      status?: number
      response?: { status?: number }
    }
    return anyError.response?.status ?? anyError.status
  }
  return undefined
}

function isRetryableQueryError(error: unknown): boolean {
  const status = getErrorStatus(error)
  if (status === undefined) {
    // Network/no-response failures are retryable.
    return true
  }
  if (NON_RETRYABLE_STATUSES.has(status)) {
    return false
  }
  return status >= 500
}

export function createQueryClient(
  options: CreateQueryClientOptions = {}
): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: (failureCount, error) => {
          if (import.meta.env.DEV) console.log({ failureCount, error })

          // Don't retry in dev.
          if (import.meta.env.DEV) return false

          // In prod, only retry retryable failures with a strict max retry count.
          if (!isRetryableQueryError(error)) return false
          return failureCount < MAX_QUERY_RETRIES_PROD
        },
        refetchOnWindowFocus: import.meta.env.PROD,
        // Don't cache data - always refetch to avoid stale auth states
        staleTime: 0,
        // Don't keep failed queries in cache
        gcTime: 1000 * 60, // 1 minute (reduced from default 5 minutes)
      },
      mutations: {
        onError: (error) => {
          if (error instanceof AxiosError) {
            if (error.response?.status === 304) {
              toast.error(t`Content not modified`)
            }
          }
        },
      },
    },
    queryCache: new QueryCache({
      onError: (error) => {
        if (getErrorStatus(error) === 403) {
          options.onForbidden?.()
        }
      },
    }),
  })
}
