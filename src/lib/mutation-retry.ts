// Copyright © 2026 Mochi OÜ
// SPDX-License-Identifier: Apache-2.0

import { AxiosError } from 'axios'

export type CallWithServerFallbackOptions = {
  /** HTTP status that triggers a single retry without server. Default: 502 */
  retryStatus?: number
}

export function getMutationErrorStatus(error: unknown): number | undefined {
  if (error instanceof AxiosError) {
    return error.response?.status
  }
  if (error instanceof Error && 'status' in error) {
    const status = (error as { status?: number }).status
    if (typeof status === 'number') {
      return status
    }
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

/**
 * Call a remote subscribe/join mutation. On retryStatus (default 502) when a
 * server/location was provided, retry once without it. Retry stays inside the
 * promise passed to toastAction so the user sees one loading toast lifecycle.
 */
export async function callWithServerFallback<T>(
  call: (server?: string) => Promise<T>,
  server?: string,
  options: CallWithServerFallbackOptions = {},
): Promise<T> {
  const retryStatus = options.retryStatus ?? 502

  try {
    return await call(server)
  } catch (error) {
    const status = getMutationErrorStatus(error)
    if (status === retryStatus && server) {
      return await call(undefined)
    }
    throw error
  }
}

/** Alias for callWithServerFallback */
export const withRemoteServerFallback = callWithServerFallback
