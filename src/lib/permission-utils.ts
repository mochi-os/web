// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: Apache-2.0

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
  options?: {
    onRestricted?: (permission: string) => void
  }
): boolean {
  const permError = isPermissionError(responseData)
  if (!permError) {
    return false
  }

  if (isInShell()) {
    shellRequestPermission(permError.permission)
      .then((result) => {
        if (result === 'granted') {
          window.location.reload()
        }
      })
    return true
  }

  // Outside the shell nothing here can ask for the permission. The caller's
  // restricted-permission callback is the only handling on offer, so the
  // answer is "handled" exactly when that callback ran; otherwise the caller
  // still owns the error and must show it.
  if (permError.restricted && options?.onRestricted) {
    options.onRestricted(permError.permission)
    return true
  }

  return false
}
