// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: Apache-2.0

const SAFE_INTERNAL_PROTOCOLS = new Set(['http:', 'https:'])
const SAFE_EXTERNAL_PROTOCOL = 'https:'

export interface SafeNavigationOptions {
  trustedExternalHosts?: readonly string[]
}

function isTrustedExternalHost(
  hostname: string,
  trustedExternalHosts: readonly string[]
): boolean {
  const normalizedHost = hostname.toLowerCase()

  return trustedExternalHosts.some((allowedHost) => {
    const normalizedAllowedHost = allowedHost.toLowerCase()

    if (normalizedAllowedHost.startsWith('*.')) {
      const suffix = normalizedAllowedHost.slice(2)
      return (
        normalizedHost === suffix || normalizedHost.endsWith(`.${suffix}`)
      )
    }

    return normalizedHost === normalizedAllowedHost
  })
}

/**
 * True when a request built from `base` and `url` resolves to the current
 * origin, so the session token may be attached to it.
 *
 * Axios treats any URL matching `<scheme>://` or `//` as absolute and drops
 * the baseURL, so a route parameter that decodes to `//host` (from a path
 * segment like `%2F%2Fhost`) turns a relative endpoint into an off-origin
 * request. The combination below mirrors axios's own buildFullPath so the
 * origin compared here is the origin actually contacted.
 *
 * This is an origin comparison, not a ban on absolute URLs: callers
 * legitimately pass absolute same-origin URLs to bypass an entity-context
 * baseURL (see search-entity-page), and those must keep their token.
 */
export function isSameOriginRequest(
  base: string | undefined,
  url: string | undefined
): boolean {
  const target = url ?? ''
  const absolute = /^([a-z][a-z\d+\-.]*:)?\/\//i.test(target)
  const combined =
    absolute || !base
      ? target
      : `${base.replace(/\/+$/, '')}/${target.replace(/^\/+/, '')}`

  try {
    return new URL(combined, window.location.href).origin === window.location.origin
  } catch {
    return false
  }
}

/**
 * True when a resource URL (an image, a download) resolves to the current
 * origin over http(s), so a session token may be added to it.
 *
 * Resolution is against document.baseURI, which is what the browser itself
 * uses for a relative `src` or `href`, so the origin tested here is the origin
 * actually fetched. A protocol-relative URL resolves off-origin and is
 * refused, as is any non-http(s) scheme.
 */
export function isSameOriginResource(url: string): boolean {
  try {
    const resolved = new URL(url, document.baseURI)
    return (
      SAFE_INTERNAL_PROTOCOLS.has(resolved.protocol) &&
      resolved.origin === window.location.origin
    )
  } catch {
    return false
  }
}

export function getSafeNavigationTarget(
  target: string | null | undefined,
  currentOrigin: string,
  options: SafeNavigationOptions = {}
): string | null {
  if (!target) return null

  const trimmedTarget = target.trim()
  if (!trimmedTarget) return null

  let baseUrl: URL
  try {
    baseUrl = new URL(currentOrigin)
  } catch {
    return null
  }

  let resolvedTarget: URL
  try {
    resolvedTarget = new URL(trimmedTarget, baseUrl)
  } catch {
    return null
  }

  const normalizedOrigin = baseUrl.origin
  const trustedExternalHosts = options.trustedExternalHosts ?? []

  if (resolvedTarget.origin === normalizedOrigin) {
    if (!SAFE_INTERNAL_PROTOCOLS.has(resolvedTarget.protocol)) return null
    return `${resolvedTarget.pathname}${resolvedTarget.search}${resolvedTarget.hash}`
  }

  if (resolvedTarget.protocol !== SAFE_EXTERNAL_PROTOCOL) return null
  if (!isTrustedExternalHost(resolvedTarget.hostname, trustedExternalHosts)) {
    return null
  }

  return resolvedTarget.toString()
}
