// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: Apache-2.0

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import axios, { AxiosError, type InternalAxiosRequestConfig } from 'axios'

vi.mock('./request', () => ({
  requestHelpers: { get: vi.fn(), post: vi.fn(), isAuthError: vi.fn(() => false) },
}))
vi.mock('./toast-utils', () => ({
  toast: { error: vi.fn(), success: vi.fn(), info: vi.fn(), warning: vi.fn() },
}))

import { authManager, logoutRedirectTarget } from './auth-manager'
import { attachApiResponseInterceptors } from './api-response-interceptors'
import { requestHelpers } from './request'
import { useAuthStore } from '../stores/auth-store'

describe('logoutRedirectTarget', () => {
  it('sends the user to the login page with no redirect by default', () => {
    expect(logoutRedirectTarget()).toBe('/')
  })

  it('keeps a same-origin return path', () => {
    expect(logoutRedirectTarget(undefined, '/feeds/abc')).toBe(
      `/?redirect=${encodeURIComponent('/feeds/abc')}`
    )
  })

  it('drops a foreign return path: a post-login redirect is an open redirect otherwise', () => {
    expect(logoutRedirectTarget(undefined, 'https://evil.example/phish')).toBe('/')
    expect(logoutRedirectTarget(undefined, '//evil.example/phish')).toBe('/')
  })

  it('marks a forced logout as a re-authentication back to the current page', () => {
    expect(logoutRedirectTarget('Session expired')).toBe(
      `/?reauth=1&redirect=${encodeURIComponent(window.location.href)}`
    )
  })
})

describe('authManager', () => {
  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    useAuthStore.getState().clearAuth()
  })
  afterEach(() => {
    vi.restoreAllMocks()
    vi.mocked(requestHelpers.get).mockReset()
  })

  it('is wired as the logout handler the moment the module loads', async () => {
    // No dynamic import in between: a 401 arriving before it resolved used to
    // fall to the bare clearAuth path instead of the manager's logout.
    const logout = vi.spyOn(authManager, 'logout').mockResolvedValue(undefined)
    useAuthStore.setState({ token: 'session-token' })
    const client = axios.create({
      adapter: async (config: InternalAxiosRequestConfig) => {
        const response = { data: {}, status: 401, statusText: '', headers: {}, config }
        throw new AxiosError('Request failed with status code 401', AxiosError.ERR_BAD_REQUEST, config, undefined, response)
      },
    })
    attachApiResponseInterceptors(client)
    await client.get('/feeds/-/list').catch(() => {})
    expect(logout).toHaveBeenCalledWith('Session expired')
  })

  it('loads the identity into the store', async () => {
    useAuthStore.setState({ token: 'session-token', isInitialized: true })
    vi.mocked(requestHelpers.get).mockResolvedValue({ identity: { id: 'person-1', name: 'Person One' } })
    await authManager.loadIdentity(true)
    expect(useAuthStore.getState().identity).toBe('person-1')
    expect(useAuthStore.getState().name).toBe('Person One')
  })

  it('marks the store initialized after a failed identity check, without re-running initialize', async () => {
    useAuthStore.setState({ token: 'session-token', isInitialized: false })
    const initialize = vi.spyOn(useAuthStore.getState(), 'initialize')
    vi.mocked(requestHelpers.get).mockRejectedValue(new Error('Network Error'))
    await authManager.loadIdentity(true)
    expect(useAuthStore.getState().isInitialized).toBe(true)
    expect(initialize).not.toHaveBeenCalled()
  })
})
