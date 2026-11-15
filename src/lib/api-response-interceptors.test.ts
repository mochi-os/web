// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: Apache-2.0

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import axios, { AxiosError, type InternalAxiosRequestConfig } from 'axios'
import { i18n } from '@lingui/core'

vi.mock('./toast-utils', () => ({
  toast: { error: vi.fn(), success: vi.fn(), info: vi.fn(), warning: vi.fn() },
}))

import {
  attachApiResponseInterceptors,
  setLogoutHandler,
} from './api-response-interceptors'
import { useAuthStore } from '../stores/auth-store'
import { toast } from './toast-utils'

// An adapter that answers with a fixed status and body, so the interceptor
// chain runs against a real axios instance without a network. The built-in
// adapters reject an error status through settle(); a custom one must do the
// same or the response interceptor sees a 401 as a success.
function clientAnswering(
  status: number,
  data: unknown,
  options?: Parameters<typeof attachApiResponseInterceptors>[1]
) {
  const client = axios.create({
    adapter: async (config: InternalAxiosRequestConfig) => {
      const response = { data, status, statusText: '', headers: {}, config }
      if (status >= 400) {
        throw new AxiosError(
          `Request failed with status code ${status}`,
          status >= 500
            ? AxiosError.ERR_BAD_RESPONSE
            : AxiosError.ERR_BAD_REQUEST,
          config,
          undefined,
          response
        )
      }
      return response
    },
  })
  attachApiResponseInterceptors(client, options)
  return client
}

describe('response interceptors', () => {
  const logout = vi.fn()

  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    setLogoutHandler(logout)
    useAuthStore.setState({ token: 'session-token' })
  })
  afterEach(() => {
    vi.clearAllMocks()
    vi.restoreAllMocks()
    useAuthStore.setState({ token: '' })
  })

  it('a 401 on an ordinary endpoint with a live session logs the user out', async () => {
    await clientAnswering(401, {})
      .get('/feeds/-/list')
      .catch(() => {})
    expect(logout).toHaveBeenCalledWith('Session expired')
  })

  it('a 401 on the login flow itself is the flow answering, not an expired session', async () => {
    await clientAnswering(401, {})
      .post('/_/auth/login')
      .catch(() => {})
    expect(logout).not.toHaveBeenCalled()
  })

  it('a 401 under a path that merely contains "auth" still logs out', async () => {
    // "/author/…" is not an auth endpoint; the substring match this replaced
    // suppressed the logout here.
    await clientAnswering(401, {})
      .get('/forums/-/author/x')
      .catch(() => {})
    expect(logout).toHaveBeenCalled()
  })

  it('a 401 with no session was anonymous access, so nothing to expire', async () => {
    useAuthStore.setState({ token: '' })
    await clientAnswering(401, {})
      .get('/feeds/-/list')
      .catch(() => {})
    expect(logout).not.toHaveBeenCalled()
  })

  it('suppress401Handling leaves the session alone', async () => {
    await clientAnswering(401, {}, { suppress401Handling: true })
      .get('/feeds/-/list')
      .catch(() => {})
    expect(logout).not.toHaveBeenCalled()
  })

  it('a 200 carrying a web page is a routing mistake, and fails', async () => {
    const page =
      '<!doctype html><html><head><title>Mochi</title></head><body></body></html>'
    const failure = await clientAnswering(200, page)
      .get('/feeds/-/lists')
      .catch((e) => e)
    expect(failure).toBeInstanceOf(Error)
    expect(failure.message).toMatch(/web page/)
  })

  it('a 500 toasts by default and is silent when the caller opts out', async () => {
    await clientAnswering(500, { error: 'boom' })
      .post('/x')
      .catch(() => {})
    expect(toast.error).toHaveBeenCalledTimes(1)
    vi.mocked(toast.error).mockClear()
    await clientAnswering(
      500,
      { error: 'boom' },
      { defaultShowGlobalErrorToast: false }
    )
      .post('/x')
      .catch(() => {})
    expect(toast.error).not.toHaveBeenCalled()
  })

  // A request can fail before the app's catalogue has loaded, when Lingui
  // throws for any message: the failure passes through as it came, with its
  // status, and nothing is toasted into a page that has not drawn yet.
  it('passes a failure through untouched and toasts nothing before a locale is active', async () => {
    vi.spyOn(i18n, 'locale', 'get').mockReturnValue('')
    for (const status of [409, 500, 502]) {
      const failure = await clientAnswering(status, { error: 'boom' })
        .post('/x')
        .catch((e: unknown) => e)
      expect(failure).toBeInstanceOf(AxiosError)
      expect((failure as AxiosError).response?.status).toBe(status)
    }
    const html = await clientAnswering(200, '<!doctype html><html></html>')
      .get('/x')
      .catch((e: unknown) => e)
    expect((html as Error).message).not.toMatch(/Lingui/)

    const offline = axios.create({
      adapter: async (config: InternalAxiosRequestConfig) => {
        throw new AxiosError('Network Error', AxiosError.ERR_NETWORK, config)
      },
    })
    attachApiResponseInterceptors(offline)
    const lost = await offline.post('/x').catch((e: unknown) => e)
    expect((lost as AxiosError).code).toBe(AxiosError.ERR_NETWORK)

    // With no logout handler the interceptor clears the session itself and
    // would say so in a toast.
    setLogoutHandler(undefined as never)
    const expired = await clientAnswering(401, {})
      .get('/feeds/-/list')
      .catch((e: unknown) => e)
    expect((expired as AxiosError).response?.status).toBe(401)
    expect(useAuthStore.getState().token).toBe('')
    expect(toast.error).not.toHaveBeenCalled()
  })

  it('never toasts a query-style request: the section owning it shows the error', async () => {
    await clientAnswering(500, { error: 'boom' })
      .get('/x')
      .catch(() => {})
    expect(toast.error).not.toHaveBeenCalled()
  })
})
