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

// Get the auth login URL from environment or default
// Normalize an entity-scoped URL for the current routing context.
// API responses return absolute paths like /feeds/<entity>/-/attachments/...
// On a whole-domain route the app/entity prefix is gone (/-/...); on a
// subpath route the prefix becomes the route path (/feed/-/...).
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
// parameter (feeds, wikis, projects, crm, market, repositories, staff).
//
// The domain check has to come first. Core injects mochi:app on entity-routed
// pages as well as path-routed ones (server web.go, since 0.4.223), so
// getAppPath() answers "/feeds" on a domain route too — and using that as the
// basepath tells the router the URL starts with /feeds/ when it actually
// starts with the domain's route path. Nothing then strips the real prefix and
// the first path segment is read as an entity id.
//
// Off a domain route this is the previous behaviour exactly: the app path
// without the entity fingerprint, which the routes supply themselves.
export function getAppBasepath(): string {
  if (isDomainEntityRouting()) return getRouterBasepath()
  const app = getAppPath()
  if (app) return app + '/'
  return getRouterBasepath()
}

// Splice the domain entity's fingerprint into a browser path.
//
// On an entity domain route the entity is named by the hostname, so it is
// absent from the URL — but the route trees all expect it as their first
// parameter. These two functions are that translation, and they are exported
// for their tests.
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

// Router history for an entity domain route, hiding the entity's fingerprint
// from the address bar. Returns undefined everywhere else, which leaves the
// router on its own default history.
//
// Only for apps whose route tree puts the entity id first ($feedId,
// $projectId, $crmId): those trees need the fingerprint spliced back in
// because their routes cannot match without it. An app whose tree is already
// domain-aware (wikis' top-level $page, repositories' blob/commit/tree) must
// NOT install this — there the domain URL genuinely has no fingerprint, and
// splicing one in sends the root to the wrong route (docs.mochi-os.org
// rendered "/" as a page named after the wiki's fingerprint).
//
// Deliberately keyed on the meta tag rather than getEntityFingerprint(): the
// rewrite is only correct when the server rendered this page as an entity
// route in the top window. Inside the shell no meta tags are injected at all.
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
