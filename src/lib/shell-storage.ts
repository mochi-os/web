// Shell storage: async localStorage proxy for sandboxed iframe apps.
// When in shell, localStorage is unavailable (opaque origin), so we relay
// via postMessage to the shell which namespaces keys by app ID.
// When not in shell, uses real localStorage directly.

import { isInShell } from './shell-bridge'

let requestId = 0
const pendingRequests = new Map<number, (value: string | null) => void>()

// Listen for storage results from shell
if (typeof window !== 'undefined') {
  window.addEventListener('message', (event: MessageEvent) => {
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
      return localStorage.getItem(key)
    } catch {
      return null
    }
  }

  return new Promise((resolve) => {
    const id = ++requestId
    pendingRequests.set(id, resolve)
    window.parent.postMessage({ type: 'storage.get', id, key }, '*')

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
      localStorage.setItem(key, value)
    } catch {
      // Ignore storage errors
    }
    return
  }
  window.parent.postMessage({ type: 'storage.set', key, value }, '*')
}

/** Remove an item from storage */
export function removeItem(key: string): void {
  if (!isInShell()) {
    try {
      localStorage.removeItem(key)
    } catch {
      // Ignore storage errors
    }
    return
  }
  window.parent.postMessage({ type: 'storage.remove', key }, '*')
}
