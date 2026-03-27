// Routing helpers that derive context from server-injected meta tags or URL path.
// Authenticated users always run inside the shell's sandboxed iframe, where no
// meta tags are injected — routing context comes from the shell init message.
// Unauthenticated/public pages may still have meta tags for OG and routing.

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
export const NOTIFICATIONS_PATH = '/notifications'

// Check if we're on a domain with entity routing (subdomain or custom domain)
export function isDomainEntityRouting(): boolean {
  if (hasMeta('mochi:domain')) return true
  const init = getShellInitData()
  return !!init?.domain
}

// Get the entity fingerprint from server context (null when not in entity context)
export function getEntityFingerprint(): string | null {
  const meta = getMeta('mochi:fingerprint')
  if (meta) return meta
  return getShellInitData()?.domain?.fingerprint ?? null
}

// Get the entity class from server context (null when not in entity context)
export function getEntityClass(): string | null {
  const meta = getMeta('mochi:class')
  if (meta) return meta
  return getShellInitData()?.domain?.class ?? null
}

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

  if (domain) return '/'
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

  if (domain) return '/-/'
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
export function getAuthLoginUrl(): string {
  return (
    (typeof import.meta !== 'undefined' &&
      import.meta.env?.VITE_AUTH_LOGIN_URL) ||
    '/'
  )
}
