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

// crm, projects and repositories each hand-roll a copy of the request
// interceptor above. Those packages have no test runner, so a behavioural test
// like the ones above cannot live with them; this asserts on their source
// instead, the way shell-bridge.test.ts guards the shell script's copy of the
// theme rules. It is weaker than driving a request, but it is revert-sensitive:
// restoring any of the three to a bare `if (token)` fails here.
//
// Skipped rather than failed when those repositories are not checked out, since
// each is its own git repo and lib/web is built and tested on its own.
describe('app-local interceptor call sites', async () => {
  const { existsSync, readFileSync } = await import('node:fs')
  const { resolve } = await import('node:path')

  const clients = ['crm', 'projects', 'repositories'].map((app) => ({
    app,
    // vitest runs with lib/web as the working directory.
    file: resolve(process.cwd(), `../../apps/${app}/web/src/api/request.ts`),
  }))
  const present = clients.filter((c) => existsSync(c.file))

  it.skipIf(present.length === 0)('found the app clients to check', () => {
    // Positive control: names which repos were actually read, so a silently
    // empty sweep cannot masquerade as three passing checks.
    expect(present.map((c) => c.app)).toEqual(['crm', 'projects', 'repositories'])
  })

  for (const { app, file } of clients) {
    it.skipIf(!existsSync(file))(`${app} gates the token on the request origin`, () => {
      const source = readFileSync(file, 'utf8')
      // Positive control: this really is a token-attaching interceptor.
      expect(source).toContain('Authorization')
      expect(source).toContain('isSameOriginRequest(config.baseURL, config.url)')
      expect(source).not.toMatch(/if \(token\) \{/)
    })
  }
})
