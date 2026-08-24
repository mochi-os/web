// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: Apache-2.0

// Shell storage: async localStorage proxy for sandboxed iframe apps.
// When in shell, localStorage is unavailable (opaque origin), so we relay
// via postMessage to the shell which namespaces keys by app ID.
// When not in shell, uses real localStorage directly.

import { fromShell, isInShell, shellOrigin } from './shell-bridge'
import { getAppPath } from './app-path'

// The shell namespaces every key as `app:<name>:` (shell.js storagePrefix), so
// the direct path must use the same namespace or a value written in the shell
// is invisible to the top window. Not applied in the shell, or it prefixes
// twice.
function namespaced(key: string): string {
  const app = getAppPath().replace(/^\//, '')
  return `app:${app}:${key}`
}

let requestId = 0
const pendingRequests = new Map<number, (value: string | null) => void>()

// Listen for storage results from shell
if (typeof window !== 'undefined') {
  window.addEventListener('message', (event: MessageEvent) => {
    // Only the shell (our direct parent) may answer: request ids are a plain
    // counter; fromShell pins the source window and the origin.
    if (!fromShell(event)) return
    const data = event.data
    if (!data || data.type !== 'storage.result') return

    const resolver = pendingRequests.get(data.id)
    if (resolver) {
      pendingRequests.delete(data.id)
      resolver(data.value ?? null)
    }
  })
}

/** Get an item from storage (async when in shell, sync-wrapped otherwise) */
export async function getItem(key: string): Promise<string | null> {
  if (!isInShell()) {
    try {
      return localStorage.getItem(namespaced(key))
    } catch {
      return null
    }
  }

  return new Promise((resolve) => {
    const id = ++requestId
    pendingRequests.set(id, resolve)
    window.parent.postMessage({ type: 'storage.get', id, key }, shellOrigin())

    // Timeout after 2 seconds
    setTimeout(() => {
      if (pendingRequests.has(id)) {
        pendingRequests.delete(id)
        resolve(null)
      }
    }, 2000)
  })
}

/** Set an item in storage */
export function setItem(key: string, value: string): void {
  if (!isInShell()) {
    try {
      localStorage.setItem(namespaced(key), value)
    } catch {
      // Ignore storage errors
    }
    return
  }
  window.parent.postMessage({ type: 'storage.set', key, value }, shellOrigin())
}

/** Remove an item from storage */
export function removeItem(key: string): void {
  if (!isInShell()) {
    try {
      localStorage.removeItem(namespaced(key))
    } catch {
      // Ignore storage errors
    }
    return
  }
  window.parent.postMessage({ type: 'storage.remove', key }, shellOrigin())
}
