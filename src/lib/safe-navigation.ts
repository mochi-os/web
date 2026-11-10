// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: Apache-2.0

import { buildFullPath } from './http'

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
      return normalizedHost === suffix || normalizedHost.endsWith(`.${suffix}`)
    }

    return normalizedHost === normalizedAllowedHost
  })
}

/**
 * True when a request built from `base` and `url` resolves to this origin, so
 * the session token may be attached. Joins them with the request client's own
 * buildFullPath, which drops the baseURL for a URL starting `//` - a route
 * parameter decoding to `//host` would otherwise carry the token off-origin.
 * Absolute same-origin URLs keep it.
 */
export function isSameOriginRequest(
  base: string | undefined,
  url: string | undefined
): boolean {
  const combined = buildFullPath(base, url)

  try {
    return (
      new URL(combined, window.location.href).origin === window.location.origin
    )
  } catch {
    return false
  }
}

/**
 * True when a resource URL (image, download) resolves to this origin over
 * http(s), so a session token may be added. Resolved against document.baseURI,
 * as the browser resolves a relative `src`; protocol-relative URLs resolve
 * off-origin.
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
