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

  it('drops cookies inside the shell, where the token is the only credential', async () => {
    // The sandboxed iframe has an opaque origin: cookies never travel, and a
    // cross-site request with credentials would be refused outright.
    Object.defineProperty(window, 'parent', {
      configurable: true,
      get: () => ({
        postMessage: () => {},
        get document(): never {
          throw new DOMException('Blocked', 'SecurityError')
        },
      }),
    })
    try {
      const { createAppClient } = await import('./create-app-client')
      const client = createAppClient({ appName: 'chat' })
      const { seen, adapter } = captureAdapter()
      await client.get('-/list', { adapter })
      expect(seen[0].withCredentials).toBe(false)
      expect(authorizationOf(seen[0])).toBe(`Bearer ${TOKEN}`)
    } finally {
      Object.defineProperty(window, 'parent', { configurable: true, get: () => window })
    }
  })

  it('keeps cookies outside the shell', async () => {
    const { createAppClient } = await import('./create-app-client')
    const client = createAppClient({ appName: 'chat' })
    const { seen, adapter } = captureAdapter()
    await client.get('-/list', { adapter })
    expect(seen[0].withCredentials).toBe(true)
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

// The regression this file exists to prevent was not a lib/web bug in
// isolation: createAppClient kept working, and every app kept its endpoint
// table, but the meaning of the paths those tables already contained changed
// underneath them. A test living only here, or only in an app, misses that by
// construction - so this one crosses the boundary and resolves each app's real
// endpoint table through the real client. Skipped per app when it is not
// checked out.
describe('app endpoint tables resolve under their own app', async () => {
  const { existsSync, readdirSync } = await import('node:fs')
  const { resolve } = await import('node:path')

  // vitest runs with lib/web as the working directory.
  const appsDirectory = resolve(process.cwd(), '../../apps')
  const table = (app: string) =>
    resolve(appsDirectory, app, 'web/src/api/endpoints.ts')

  const apps = existsSync(appsDirectory)
    ? readdirSync(appsDirectory).filter((app) => existsSync(table(app)))
    : []

  // Endpoint tables are nested objects of strings and path builders. Call the
  // builders with a placeholder so a `${id}/-/view` template yields a concrete
  // path; extra arguments are harmless for the shorter ones.
  const pathsOf = (node: unknown, found: string[] = []): string[] => {
    if (typeof node === 'string') found.push(node)
    else if (typeof node === 'function') {
      try {
        pathsOf((node as (...a: string[]) => unknown)('ID', 'ID'), found)
      } catch {
        // A builder needing something other than an id is not this test's
        // subject; the literal tables are.
      }
    } else if (node && typeof node === 'object') {
      for (const value of Object.values(node)) pathsOf(value, found)
    }
    return found
  }

  // An action path, not an arbitrary string that happens to sit in the table.
  // `/_/...` is core's own surface: it belongs at the origin root and its
  // callers pass an explicit `{ baseURL: '/' }` (apps/air/web/src/lib/
  // config-store.ts does), so it is a different contract and not asserted
  // here. The dead `/_/` entries in apps/apps' table are tracked as #42.
  const isAction = (path: string) =>
    path.includes('-/') && !path.startsWith('/_/')

  it('finds the app tables to check', () => {
    expect(apps.length).toBeGreaterThan(0)
  })

  for (const app of apps) {
    it(`${app}`, async () => {
      // Most tables are a default export; market, recommendations and staff
      // export `endpoints` by name.
      const module = await import(/* @vite-ignore */ table(app))
      const paths = pathsOf(module.default ?? module.endpoints).filter(isAction)
      // Positive control: an app whose paths all filtered out would pass
      // vacuously, which is the failure mode this whole file is about.
      expect(paths.length).toBeGreaterThan(0)

      const { createAppClient } = await import('./create-app-client')
      const client = createAppClient({ appName: app })
      const resolved = await Promise.all(
        paths.map(async (path) => {
          const { seen, adapter } = captureAdapter()
          await client.get(path, { adapter })
          return [path, client.instance.getUri(seen[0])] as const
        })
      )
      for (const [path, uri] of resolved) {
        expect(uri, `${path} should resolve under /${app}/`).toMatch(
          new RegExp(`^/${app}/`)
        )
      }
      // crm, forums, people and projects import their shared endpoints from
      // @mochi/web, so the import pulls the library barrel through the
      // transform; that exceeds the 5s default once the whole suite is running.
    }, 30000)
  }
})

// The apps with their own request module all build on the shared client, so
// its tests above cover them. Reintroducing a private interceptor would
// silently reopen the gap those tests exist to close. Skipped when the app
// repository is not checked out.
describe('app-local request modules', async () => {
  const { existsSync, readFileSync } = await import('node:fs')
  const { resolve } = await import('node:path')

  // vitest runs with lib/web as the working directory.
  const appFile = (app: string) =>
    resolve(process.cwd(), `../../apps/${app}/web/src/api/request.ts`)

  const shared = ['crm', 'projects', 'repositories']

  for (const app of shared) {
    it.skipIf(!existsSync(appFile(app)))(
      `${app} attaches no interceptor of its own`,
      () => {
        const source = readFileSync(appFile(app), 'utf8')
        expect(source).toContain('createAppClient')
        expect(source).not.toContain('interceptors.request.use')
        expect(source).not.toContain('Authorization')
      }
    )
  }
})
