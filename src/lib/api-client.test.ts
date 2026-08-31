// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: Apache-2.0

// Each client is actually wired to the origin policy, driven through the
// interceptor and read off the outgoing headers; safe-navigation.test.ts covers
// the policy itself.

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import type { InternalAxiosRequestConfig } from 'axios'

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

// Where a request actually lands, not just what it carries. Every test above
// reads headers, so nothing pinned the resolved URL, and a change that sent
// class-level calls to the origin root passed the whole file. getUri is
// axios's own public resolver, so these assert the real combination rather
// than a restatement of it.
describe('app client URL resolution', () => {
  const uriOf = async (appName: string, url: string) => {
    const { createAppClient } = await import('./create-app-client')
    const client = createAppClient({ appName })
    const { seen, adapter } = captureAdapter()
    await client.get(url, { adapter })
    return client.instance.getUri(seen[0])
  }

  // The regression: a leading slash is app-relative here, not origin-root.
  // Sending these to the root matched core's SPA catch-all, which answers 200
  // with HTML, so the failure surfaced as an empty list rather than an error.
  it('resolves a class-level path under the app', async () => {
    expect(await uriOf('chat', '/-/list')).toBe('/chat/-/list')
  })

  it('resolves an entity-scoped path under the app', async () => {
    expect(await uriOf('chess', '/abc123/-/view')).toBe('/chess/abc123/-/view')
  })

  it('resolves a path written without the leading slash under the app', async () => {
    expect(await uriOf('feeds', 'abc123/-/info')).toBe('/feeds/abc123/-/info')
  })

  it('leaves an absolute URL alone', async () => {
    expect(await uriOf('feeds', 'https://example.test/x')).toBe(
      'https://example.test/x'
    )
  })
})

// The /_/ rule lives on apiClient, which is what login and settings reach core
// through. createAppClient deliberately has no copy: no app client calls /_/,
// and the copy it briefly had is what broke the four apps above.
describe('apiClient URL resolution', () => {
  it('sends a core endpoint to the origin root', async () => {
    const { apiClient } = await import('./api-client')
    const { seen, adapter } = captureAdapter()
    await apiClient.get('/_/identity', { adapter })
    expect(apiClient.getUri(seen[0])).toBe('/_/identity')
  })
})

// repositories hand-rolls its interceptor and its package has no test runner,
// so it is guarded by asserting on its source: restoring it to a bare `if
// (token)` fails here. Skipped when the app repository is not checked out.
describe('app-local interceptor call sites', async () => {
  const { existsSync, readFileSync } = await import('node:fs')
  const { resolve } = await import('node:path')

  // vitest runs with lib/web as the working directory.
  const appFile = (app: string) =>
    resolve(process.cwd(), `../../apps/${app}/web/src/api/request.ts`)

  const own = 'repositories'
  const shared = ['crm', 'projects']

  it.skipIf(!existsSync(appFile(own)))(
    `${own} gates the token on the request origin`,
    () => {
      const source = readFileSync(appFile(own), 'utf8')
      // Positive control: this really is a token-attaching interceptor.
      expect(source).toContain('Authorization')
      expect(source).toContain('isSameOriginRequest(config.baseURL, config.url)')
      expect(source).not.toMatch(/if \(token\) \{/)
    }
  )

  for (const app of shared) {
    it.skipIf(!existsSync(appFile(app)))(
      `${app} attaches no interceptor of its own`,
      () => {
        const source = readFileSync(appFile(app), 'utf8')
        // Reintroducing a private interceptor would silently reopen the gap
        // these tests exist to close, so assert the app stays on the shared
        // client rather than merely that any copy is currently correct.
        expect(source).toContain('createAppClient')
        expect(source).not.toContain('interceptors.request.use')
        expect(source).not.toContain('Authorization')
      }
    )
  }
})
