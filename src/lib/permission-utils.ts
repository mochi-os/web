// Permission error handling utilities

import { isInShell, shellRequestPermission } from './shell-bridge'

export interface PermissionError {
  app: string
  permission: string
  restricted: boolean
}

// Check if an error response is a permission error
// Backend returns: { error: "permission_required", app: string, permission: string, restricted: boolean }
export function isPermissionError(responseData: unknown): PermissionError | null {
  if (
    responseData &&
    typeof responseData === 'object' &&
    'error' in responseData
  ) {
    const data = responseData as { error?: string; app?: string; permission?: string; restricted?: boolean }
    if (data.error === 'permission_required' && data.permission) {
      return {
        app: data.app || '',
        permission: data.permission,
        restricted: data.restricted ?? false,
      }
    }
  }
  return null
}

// Get the current app ID from the URL (e.g., "feeds" from "/feeds/something")
export function getCurrentAppId(): string {
  const path = window.location.pathname
  const match = path.match(/^\/([^/]+)/)
  return match ? match[1] : ''
}

// Handle a permission error by showing the shell permission dialog (standard) or notifying about restricted permissions
// Returns true if the error was handled, false otherwise
export function handlePermissionError(
  responseData: unknown,
  appId?: string,
  options?: {
    onRestricted?: (permission: string) => void
  }
): boolean {
  const permError = isPermissionError(responseData)
  if (!permError) {
    return false
  }

  // Use app ID from error response, fall back to provided appId, then URL path
  const resolvedAppId = permError.app || appId || getCurrentAppId()

  if (isInShell()) {
    shellRequestPermission(resolvedAppId, permError.permission, permError.restricted)
      .then((result) => {
        if (result === 'granted') {
          window.location.reload()
        }
      })
    return true
  }

  // Restricted permission - call the callback if provided
  if (permError.restricted) {
    if (options?.onRestricted) {
      options.onRestricted(permError.permission)
    }
    return true
  }

  return true
}
