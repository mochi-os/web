// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: Apache-2.0

// Routing helpers that derive context from server-injected meta tags or URL path.
// Authenticated users always run inside the shell's sandboxed iframe, where no
// meta tags are injected — routing context comes from the shell init message.
// Unauthenticated/public pages may still have meta tags for OG and routing.

import {
  createBrowserHistory,
  type HistoryLocation,
  type RouterHistory,
} from '@tanstack/react-router'
import { getShellInitData } from './shell-bridge'

// Read a server-injected meta tag value (null when absent)
function getMeta(name: string): string | null {
  return document.querySelector(`meta[name="${name}"]`)?.getAttribute('content') ?? null
}

// Check whether a server-injected meta tag is present
function hasMeta(name: string): boolean {
  return document.querySelector(`meta[name="${name}"]`) !== null
}

// Canonical path for cross-app API calls to the notifications app

// Check if we're on a domain with entity routing (subdomain or custom domain)
export function isDomainEntityRouting(): boolean {
  if (hasMeta('mochi:domain')) return true
  const init = getShellInitData()
  return !!init?.domain
}

// For domain routing: the matched route path with a trailing slash.
// '/' for whole-domain routes, '/feed/' for subpath routes like
// acunningham.org/feed → feed entity. Falls back to '/' for shell mode
// where route info isn't passed through (shell apps aren't on subpath routes).
function getDomainRoutePath(): string {
  const meta = getMeta('mochi:domain')
  if (meta && meta !== '/') {
    return meta.endsWith('/') ? meta : meta + '/'
  }
  return '/'
}

// Get the entity fingerprint from server context (null when not in entity context)
export function getEntityFingerprint(): string | null {
  const meta = getMeta('mochi:fingerprint')
  if (meta) return meta
  return getShellInitData()?.domain?.fingerprint ?? null
}

// Get the entity class from server context (null when not in entity context)

// Get the app path (e.g. "/wikis"). Empty string when not path-routed.
export function getAppPath(): string {
  const app = getMeta('mochi:app')
  if (app !== null) return '/' + app
  // Domain routing or direct entity routing — no app in URL
  if (isDomainEntityRouting() || hasMeta('mochi:fingerprint')) return ''
  // Derive from URL path: first path segment
  const match = window.location.pathname.match(/^\/([^/]+)/)
  return match ? '/' + match[1] : ''
}

// Get the router basepath for TanStack Router
export function getRouterBasepath(): string {
  const app = getMeta('mochi:app')
  const fingerprint = getMeta('mochi:fingerprint')
  const domain = isDomainEntityRouting()

  if (domain) return getDomainRoutePath()
  if (fingerprint && app) return `/${app}/${fingerprint}/`
  if (fingerprint) return `/${fingerprint}/`
  if (app) return `/${app}/`

  // Derive from URL path
  const match = window.location.pathname.match(/^\/([^/]+)/)
  return match ? '/' + match[1] + '/' : '/'
}

// Get the API basepath for backend calls
export function getApiBasepath(): string {
  const app = getMeta('mochi:app')
  const entity = getMeta('mochi:entity')
  const fingerprint = getMeta('mochi:fingerprint')
  const domain = isDomainEntityRouting()

  if (domain) return getDomainRoutePath() + '-/'
  if (entity && app) return `/${app}/${entity}/-/`
  if (entity) return `/${entity}/-/`
  // For remote entities, server injects fingerprint without entity/class
  if (fingerprint && app) return `/${app}/${fingerprint}/-/`
  if (fingerprint) return `/${fingerprint}/-/`
  if (app) return `/${app}/`

  // Derive from URL path
  const match = window.location.pathname.match(/^\/([^/]+)/)
  return match ? '/' + match[1] + '/' : '/'
}

// Normalize an entity-scoped URL for the current routing context. API responses
// carry absolute paths like /feeds/<entity>/-/...; a whole-domain route drops
// that prefix, a subpath route replaces it with the route path.
export function normalizeEntityUrl(url: string): string {
  if (!isDomainEntityRouting()) return url
  const idx = url.indexOf('/-/')
  if (idx < 0) return url
  const suffix = url.slice(idx)
  const base = getDomainRoutePath()
  if (base === '/') return suffix
  return base.slice(0, -1) + suffix
}

// Router basepath for apps whose routes carry the entity id as a route
// parameter. The domain check comes first: core injects mochi:app on domain
// routes too, so getAppPath() would name a prefix the URL does not have and the
// first segment would be read as an entity id.
export function getAppBasepath(): string {
  if (isDomainEntityRouting()) return getRouterBasepath()
  const app = getAppPath()
  if (app) return app + '/'
  return getRouterBasepath()
}

// Splice the domain entity's fingerprint into a browser path. On a domain route
// the entity is named by the hostname and absent from the URL, but the route
// trees expect it as their first parameter.
export function entityRouterPath(path: string, base: string, fingerprint: string): string {
  if (!path.startsWith(base)) return path
  const rest = path.slice(base.length)
  // Already canonical: a link written before this mapping existed, or one the
  // router itself produced. Left alone here, createHref shortens it on the way
  // back out, so the URL converges on the short form.
  if (rest === fingerprint || rest.startsWith(fingerprint + '/')) return path
  return base + fingerprint + (rest ? '/' + rest : '')
}

// Remove the domain entity's fingerprint from a router path.
export function entityBrowserPath(path: string, base: string, fingerprint: string): string {
  if (!path.startsWith(base)) return path
  const rest = path.slice(base.length)
  if (rest === fingerprint) return base
  if (rest.startsWith(fingerprint + '/')) return base + rest.slice(fingerprint.length + 1)
  return path
}

// Split a href into its path and the search/hash that follow it.
function splitHref(href: string): [string, string] {
  const index = href.search(/[?#]/)
  return index < 0 ? [href, ''] : [href.slice(0, index), href.slice(index)]
}

// Mirrors parseHref from @tanstack/history, which the router does not
// re-export. createBrowserHistory guarantees window.history.state carries the
// router's key before it first calls parseLocation, so the state is passed
// straight through.
function parseHistoryHref(href: string, state: unknown): HistoryLocation {
  const hash = href.indexOf('#')
  const search = href.indexOf('?')
  const end =
    hash > 0 ? (search > 0 ? Math.min(hash, search) : hash) : search > 0 ? search : href.length
  return {
    href,
    pathname: href.substring(0, end),
    hash: hash > -1 ? href.substring(hash) : '',
    search: search > -1 ? href.slice(search, hash === -1 ? undefined : hash) : '',
    state: (state ?? { __TSR_index: 0 }) as HistoryLocation['state'],
  }
}

// Router history for an entity domain route, hiding the fingerprint from the
// address bar; undefined everywhere else. Only for route trees that put the
// entity id first - a domain-aware tree (wikis, repositories) routes its root
// wrong with one spliced in. Keyed on the meta tag, which only a top-window
// entity route has.
export function createAppHistory(window_?: Window): RouterHistory | undefined {
  const win = window_ ?? (typeof window !== 'undefined' ? window : undefined)
  if (!win) return undefined
  if (!isDomainEntityRouting()) return undefined
  const fingerprint = getMeta('mochi:fingerprint')
  if (!fingerprint) return undefined
  const base = getDomainRoutePath()

  return createBrowserHistory({
    window: win,
    parseLocation: () =>
      parseHistoryHref(
        entityRouterPath(win.location.pathname, base, fingerprint) +
          win.location.search +
          win.location.hash,
        win.history.state
      ),
    createHref: (href) => {
      const [path, rest] = splitHref(href)
      return entityBrowserPath(path, base, fingerprint) + rest
    },
  })
}

export function getAuthLoginUrl(): string {
  return (
    (typeof import.meta !== 'undefined' &&
      import.meta.env?.VITE_AUTH_LOGIN_URL) ||
    '/'
  )
}
