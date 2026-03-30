// Shell bridge: communication between sandboxed iframe apps and the shell page.
// When an app runs inside the shell's sandboxed iframe, it has an opaque origin
// and cannot access cookies, localStorage, or the parent DOM. All communication
// happens via postMessage.

type DomainRouteInfo = {
  method: string
  entity: string
  fingerprint: string
  class: string
}

type ShellInitData = {
  token: string
  theme?: string
  user: { name: string }
  inShell: boolean
  sidebarOpen?: boolean
  domain?: DomainRouteInfo | null
}

type ShellMessage = {
  type: string
  [key: string]: unknown
}

let shellInitData: ShellInitData | null = null
let shellInitPromise: Promise<ShellInitData> | null = null
let messageListeners: Array<(msg: ShellMessage) => void> = []

/** Check if the app is running inside the shell's sandboxed iframe */
export function isInShell(): boolean {
  if (typeof window === 'undefined') return false

  // Fast path: already detected
  if (shellInitData !== null) return true

  // Check if we're in a cross-origin iframe by trying to access parent document
  try {
    if (window.parent === window) return false
    // This will throw SecurityError for sandboxed iframes (opaque origin)
    void window.parent.document
    return false // Same origin — not sandboxed
  } catch {
    return true // SecurityError — we're in a sandboxed iframe
  }
}

/** Initialize the shell bridge. Sends 'ready' and waits for 'init' from shell. */
export function initShellBridge(): Promise<ShellInitData> {
  if (shellInitPromise) return shellInitPromise

  if (!isInShell()) {
    return Promise.resolve({
      token: '',
      user: { name: '' },
      inShell: false,
    })
  }

  shellInitPromise = new Promise((resolve) => {
    function onMessage(event: MessageEvent) {
      const data = event.data
      if (!data || typeof data !== 'object') return

      if (data.type === 'init') {
        window.removeEventListener('message', onMessage)
        shellInitData = data as ShellInitData
        resolve(shellInitData)
      }
    }

    window.addEventListener('message', onMessage)

    // Tell the shell we're ready
    window.parent.postMessage({ type: 'ready' }, '*')
  })

  return shellInitPromise
}

/** Get the cached init data (null if not yet initialized) */
export function getShellInitData(): ShellInitData | null {
  return shellInitData
}

/** Send a navigation event to the shell (intra-app) */
export function shellNavigate(path: string): void {
  if (!isInShell()) {
    window.location.href = path
    return
  }
  window.parent.postMessage({ type: 'navigate', path }, '*')
}

/** Send a cross-app navigation event to the shell */
export function shellNavigateExternal(url: string): void {
  if (!isInShell()) {
    window.location.href = url
    return
  }
  window.parent.postMessage({ type: 'navigate-external', url }, '*')
}

/** Update the document title (syncs to shell) */
export function shellSetTitle(title: string): void {
  document.title = title
  if (isInShell()) {
    window.parent.postMessage({ type: 'title', title }, '*')
  }
}

/** Notify the shell of sidebar state changes */
export function shellSetSidebarState(open: boolean): void {
  if (isInShell()) {
    window.parent.postMessage({ type: 'sidebar-state', open }, '*')
  }
}

/** Write text to the clipboard. Uses the shell proxy when sandboxed. */
let clipboardIdCounter = 0
const clipboardCallbacks = new Map<number, (ok: boolean) => void>()

export function shellClipboardWrite(text: string): Promise<boolean> {
  // Outside shell, use native API directly
  if (!isInShell()) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      return navigator.clipboard.writeText(text).then(() => true, () => false)
    }
    return Promise.resolve(false)
  }

  // In shell, proxy through the parent
  const id = ++clipboardIdCounter
  return new Promise((resolve) => {
    clipboardCallbacks.set(id, resolve)
    window.parent.postMessage({ type: 'clipboard.write', text, id }, '*')
  })
}

/**
 * Monkey-patch navigator.clipboard.writeText to route through the shell proxy.
 * This makes all existing navigator.clipboard.writeText() calls work automatically
 * in the sandboxed iframe without changing any app code.
 */
let clipboardProxyInstalled = false
export function installShellClipboardProxy(): void {
  if (clipboardProxyInstalled || !isInShell()) return
  clipboardProxyInstalled = true

  if (!navigator.clipboard) {
    // Create a minimal clipboard object if it doesn't exist
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: (_text: string) => Promise.resolve() },
      writable: true,
      configurable: true,
    })
  }

  navigator.clipboard.writeText = function (text: string): Promise<void> {
    return shellClipboardWrite(text).then((ok) => {
      if (!ok) throw new DOMException('Clipboard write failed', 'NotAllowedError')
    })
  }
}

/** Listen for messages from the shell */
export function onShellMessage(listener: (msg: ShellMessage) => void): () => void {
  messageListeners.push(listener)

  return () => {
    messageListeners = messageListeners.filter((l) => l !== listener)
  }
}

/** Safely read document.cookie (returns '' in sandboxed iframes) */
export function safeCookieGet(): string {
  try {
    return document.cookie
  } catch {
    return ''
  }
}

/** Safely write document.cookie (no-op in sandboxed iframes) */
export function safeCookieSet(value: string): void {
  try {
    document.cookie = value
  } catch {
    // Sandboxed iframe — cannot set cookies
  }
}

/**
 * Install a global click handler that intercepts cross-app <a> clicks
 * and routes them through shellNavigateExternal() instead of letting
 * the iframe navigate directly (which would fail — no cookies).
 */
let linkInterceptorInstalled = false
export function installShellLinkInterceptor(): void {
  if (linkInterceptorInstalled || !isInShell()) return
  linkInterceptorInstalled = true

  const currentApp = window.location.pathname.match(/^\/([^/]+)/)?.[1] || ''

  document.addEventListener('click', (event) => {
    // Find the nearest <a> element
    const target = (event.target as HTMLElement).closest?.('a')
    if (!target) return

    const href = target.getAttribute('href')
    if (!href) return

    // Only intercept absolute-path links to other apps
    if (!href.startsWith('/')) return

    const linkApp = href.match(/^\/([^/]+)/)?.[1] || ''
    if (!linkApp || linkApp === currentApp || linkApp.startsWith('_')) return

    // Cross-app link — route through shell
    event.preventDefault()
    event.stopPropagation()
    shellNavigateExternal(href)
  }, true) // capture phase to intercept before app handlers
}

/**
 * Monkey-patch history.pushState and history.replaceState so that
 * client-side navigation inside the iframe (e.g. TanStack Router)
 * is relayed to the shell to keep the URL bar in sync.
 */
let navigationSyncInstalled = false
export function installShellNavigationSync(): void {
  if (navigationSyncInstalled || !isInShell()) return
  navigationSyncInstalled = true

  const origPushState = history.pushState.bind(history)
  const origReplaceState = history.replaceState.bind(history)

  const notifyShell = () => {
    const path = window.location.pathname + window.location.search + window.location.hash
    window.parent.postMessage({ type: 'navigate', path }, '*')
  }

  history.pushState = function (...args: Parameters<typeof history.pushState>) {
    origPushState(...args)
    notifyShell()
  }

  history.replaceState = function (...args: Parameters<typeof history.replaceState>) {
    origReplaceState(...args)
    notifyShell()
  }

  // Also catch popstate (back/forward within iframe)
  window.addEventListener('popstate', () => notifyShell())
}

/**
 * Add auth token to a URL for resource requests (images, downloads) in sandboxed iframes.
 * In shell mode, <img src> and <a href> can't send Bearer headers or cookies,
 * so the token is added as a query parameter.
 * Outside the shell, returns the URL unchanged.
 */
export function authenticatedUrl(url: string): string {
  if (!isInShell() || !shellInitData) return url

  // Only add token to same-origin URLs (relative paths or same host)
  // External URLs (https://other-server.com/...) don't need our token
  if (/^https?:\/\//i.test(url)) return url

  const token = shellInitData.token
  if (!token) return url

  const rawToken = token.startsWith('Bearer ') ? token.slice(7) : token
  const separator = url.includes('?') ? '&' : '?'
  return `${url}${separator}token=${encodeURIComponent(rawToken)}`
}

/** Request the shell to show the subscribe-notifications dialog */
let subscribeIdCounter = 0
const subscribeCallbacks = new Map<number, (result: string) => void>()

export function shellSubscribeNotifications(
  app: string,
  subscriptions: Array<{ label: string; type: string; object?: string; defaultEnabled?: boolean }>
): Promise<'accepted' | 'declined'> {
  const id = ++subscribeIdCounter
  return new Promise((resolve) => {
    subscribeCallbacks.set(id, resolve as (r: string) => void)
    window.parent.postMessage({ type: 'subscribe-notifications', id, app, subscriptions }, '*')
  })
}

/** Request the shell to show the permission request dialog */
let permissionIdCounter = 0
const permissionCallbacks = new Map<number, (result: string) => void>()

export function shellRequestPermission(
  app: string,
  permission: string,
  restricted: boolean
): Promise<'granted' | 'denied'> {
  const id = ++permissionIdCounter
  return new Promise((resolve) => {
    permissionCallbacks.set(id, resolve as (r: string) => void)
    window.parent.postMessage({ type: 'request-permission', id, app, permission, restricted }, '*')
  })
}

/** Proxy a fetch request through the shell (menu app handles it with auth) */
let fetchIdCounter = 0
const fetchCallbacks = new Map<number, (result: { ok: boolean; status: number; data: unknown }) => void>()

export function shellFetch<T = unknown>(path: string, init?: { method?: string; body?: string }): Promise<T> {
  if (!isInShell()) {
    // Outside shell, fetch directly
    return fetch(path, {
      credentials: 'same-origin',
      method: init?.method,
      headers: init?.body ? { 'Content-Type': 'application/x-www-form-urlencoded' } : undefined,
      body: init?.body,
    }).then(async (res) => {
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error((body as { error?: string }).error || `Error ${res.status}`)
      }
      return res.json() as Promise<T>
    })
  }

  const id = ++fetchIdCounter
  return new Promise((resolve, reject) => {
    fetchCallbacks.set(id, (result) => {
      if (result.ok) {
        resolve(result.data as T)
      } else {
        reject(new Error((result.data as { error?: string })?.error || `Error ${result.status}`))
      }
    })
    window.parent.postMessage({
      type: 'shell-fetch',
      id,
      path,
      method: init?.method || 'GET',
      body: init?.body,
    }, '*')
  })
}

// Global message listener — routes shell messages to registered listeners
if (typeof window !== 'undefined') {
  window.addEventListener('message', (event: MessageEvent) => {
    const data = event.data
    if (!data || typeof data !== 'object' || !data.type) return

    // Handle token refresh
    if (data.type === 'token-refresh' && shellInitData) {
      shellInitData.token = data.token as string
    }

    // Handle clipboard result
    if (data.type === 'clipboard.result') {
      const cb = clipboardCallbacks.get(data.id as number)
      if (cb) {
        clipboardCallbacks.delete(data.id as number)
        cb(data.ok as boolean)
      }
    }

    // Handle subscribe-notifications result
    if (data.type === 'subscribe-notifications-result') {
      const cb = subscribeCallbacks.get(data.id as number)
      if (cb) {
        subscribeCallbacks.delete(data.id as number)
        cb(data.result as string)
      }
    }

    // Handle shell-fetch result
    if (data.type === 'shell-fetch-result') {
      const cb = fetchCallbacks.get(data.id as number)
      if (cb) {
        fetchCallbacks.delete(data.id as number)
        cb(data as { ok: boolean; status: number; data: unknown })
      }
    }

    // Handle permission-result
    if (data.type === 'permission-result') {
      const cb = permissionCallbacks.get(data.id as number)
      if (cb) {
        permissionCallbacks.delete(data.id as number)
        cb(data.result as string)
      }
    }

    // Route to all registered listeners
    for (const listener of messageListeners) {
      listener(data as ShellMessage)
    }
  })
}
