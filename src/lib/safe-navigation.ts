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
