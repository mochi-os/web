// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: Apache-2.0

// Interceptor-level coverage. safe-navigation.test.ts proves the origin
// POLICY is right; these prove each client is actually WIRED to it, by driving
// a real request through the interceptor and inspecting the outgoing headers.
// Testing the helper alone would let a revert of the interceptor call site
// pass unnoticed.

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import type { InternalAxiosRequestConfig } from 'axios'

// The response-interceptor module reaches for the Lingui macro, which this
// package's vitest config does not transform. It attaches RESPONSE handling
// only and has no bearing on the outgoing Authorization header, so stubbing it
// keeps the request interceptor under test intact.
vi.mock('./api-response-interceptors', () => ({
  attachApiResponseInterceptors: () => {},
  setLogoutHandler: () => {},
}))

const TOKEN = 'test-token'

// Swap in an adapter that answers every request locally and hands back the
// config the interceptor produced, so nothing touches the network.
function captureAdapter() {
  const seen: InternalAxiosRequestConfig[] = []
  const adapter = async (config: InternalAxiosRequestConfig) => {
    seen.push(config)
    return { data: {}, status: 200, statusText: 'OK', headers: {}, config }
  }
  return { seen, adapter }
}

function authorizationOf(config: InternalAxiosRequestConfig): unknown {
  const headers = config.headers as unknown as Record<string, unknown>
  return headers?.Authorization
}

beforeEach(async () => {
  const { useAuthStore } = await import('../stores/auth-store')
  useAuthStore.setState({ token: TOKEN })
})

afterEach(() => {
  vi.resetModules()
})

describe('apiClient interceptor', () => {
  it('sends the token to a same-origin path', async () => {
    const { apiClient } = await import('./api-client')
    const { seen, adapter } = captureAdapter()
    await apiClient.get('/_/identity', { adapter })

    // Positive control: the token is in the store and the interceptor ran, so
    // an absent header below is a refusal rather than an unconfigured client.
    expect(seen).toHaveLength(1)
    expect(authorizationOf(seen[0])).toBe(`Bearer ${TOKEN}`)
  })

  it('withholds the token from a protocol-relative URL', async () => {
    const { apiClient } = await import('./api-client')
    const { seen, adapter } = captureAdapter()
    await apiClient.get('//attacker.example/-/info', { adapter })
    expect(authorizationOf(seen[0])).toBeUndefined()
  })

  it('withholds the token from an absolute foreign URL', async () => {
    const { apiClient } = await import('./api-client')
    const { seen, adapter } = captureAdapter()
    await apiClient.get('https://attacker.example/x', { adapter })
    expect(authorizationOf(seen[0])).toBeUndefined()
  })
})

describe('createAppClient interceptor', () => {
  it('sends the token to a relative endpoint under the app baseURL', async () => {
    const { createAppClient } = await import('./create-app-client')
    const client = createAppClient({ appName: 'feeds' })
    const { seen, adapter } = captureAdapter()
    await client.get('abc/-/info', { adapter })

    expect(seen).toHaveLength(1)
    expect(authorizationOf(seen[0])).toBe(`Bearer ${TOKEN}`)
  })

  it('withholds the token when a route parameter decoded to //host', async () => {
    const { createAppClient } = await import('./create-app-client')
    const client = createAppClient({ appName: 'feeds' })
    const { seen, adapter } = captureAdapter()

    // The live vector: /feeds/%2F%2Fattacker.example decodes to
    // "//attacker.example" and lands in the endpoint builder's first slot.
    const feedId = decodeURIComponent('%2F%2Fattacker.example')
    await client.get(`${feedId}/-/info`, { adapter })
    expect(authorizationOf(seen[0])).toBeUndefined()
  })

  it('withholds the token from an absolute foreign URL', async () => {
    const { createAppClient } = await import('./create-app-client')
    const client = createAppClient({ appName: 'feeds' })
    const { seen, adapter } = captureAdapter()
    await client.get('https://attacker.example/x', { adapter })
    expect(authorizationOf(seen[0])).toBeUndefined()
  })
})
