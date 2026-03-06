// Routing helpers that read server-injected meta tags
// The Mochi server injects <meta name="mochi:*"> tags into HTML responses
// to communicate routing context. On dev servers these are absent and we
// fall back to URL parsing.

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
  return hasMeta('mochi:domain')
}

// Get the entity fingerprint from server context (null when not in entity context)
export function getEntityFingerprint(): string | null {
  return getMeta('mochi:fingerprint')
}

// Get the entity class from server context (null when not in entity context)
export function getEntityClass(): string | null {
  return getMeta('mochi:class')
}

// Get the app path (e.g. "/wikis"). Empty string when not path-routed.
export function getAppPath(): string {
  const app = getMeta('mochi:app')
  if (app !== null) return '/' + app
  // Domain routing or direct entity routing — no app in URL
  if (hasMeta('mochi:domain') || hasMeta('mochi:fingerprint')) return ''
  // Fallback for dev server: first path segment
  const match = window.location.pathname.match(/^\/([^/]+)/)
  return match ? '/' + match[1] : ''
}

// Get the router basepath for TanStack Router
export function getRouterBasepath(): string {
  const app = getMeta('mochi:app')
  const fingerprint = getMeta('mochi:fingerprint')
  const domain = hasMeta('mochi:domain')

  if (domain) return '/'
  if (fingerprint && app) return `/${app}/${fingerprint}/`
  if (fingerprint) return `/${fingerprint}/`
  if (app) return `/${app}/`

  // Fallback for dev server
  const match = window.location.pathname.match(/^\/([^/]+)/)
  return match ? '/' + match[1] + '/' : '/'
}

// Get the API basepath for backend calls
export function getApiBasepath(): string {
  const app = getMeta('mochi:app')
  const entity = getMeta('mochi:entity')
  const fingerprint = getMeta('mochi:fingerprint')
  const domain = hasMeta('mochi:domain')

  if (domain) return '/-/'
  if (entity && app) return `/${app}/${entity}/-/`
  if (entity) return `/${entity}/-/`
  // For remote entities, server injects fingerprint without entity/class
  if (fingerprint && app) return `/${app}/${fingerprint}/-/`
  if (fingerprint) return `/${fingerprint}/-/`
  if (app) return `/${app}/`

  // Fallback for dev server
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
