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

export type ColorTheme = {
  hue: string
  chroma: string
  hueBg: string
  overrides?: Record<string, string>
}

export type LocalePreferences = {
  date_format: string
  time_format: string
  timestamp_display: string
  week_start: string
  number_format: string
  units: string
  timezone: string
}

type ShellInitData = {
  token: string
  theme?: string
  colorTheme?: ColorTheme | null
  inShell: boolean
  sidebarOpen?: boolean
  domain?: DomainRouteInfo | null
  locale?: LocalePreferences | null
  /**
   * BCP 47 language tag for the active i18n catalog. Sourced from the user's
   * `language` preference if logged in, else the request's Accept-Language,
   * else "en". Wave 2 of the i18n plan; the I18nProvider in lib/web reads it.
   */
  language?: string | null
  /**
   * Source server URL when this account arrived here via a server-move
   * restore, with the list of third-party services to re-link. Drives the
   * post-restore RestoreBanner. Absent for normally-created accounts.
   */
  restoreSource?: string | null
  relinks?: { service: string; identifier: string }[] | null
  /**
   * True when the restored account had passkeys on the source server.
   * Passkeys are bound to their origin and don't travel in a backup, so the
   * banner prompts the user to re-register them here.
   */
  restorePasskeys?: boolean | null
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
      inShell: false,
    })
  }

  shellInitPromise = new Promise((resolve) => {
    const timeoutId = window.setTimeout(() => {
      window.removeEventListener('message', onMessage)
      shellInitData = { token: '', inShell: true }
      resolve(shellInitData)
    }, 5000)

    function onMessage(event: MessageEvent) {
      // Only the shell (our direct parent) may drive the bridge. The iframe's
      // own origin is opaque so we can't pin event.origin; pinning the source
      // window blocks injection from siblings, popups, or embedded frames.
      if (event.source !== window.parent) return
      const data = event.data
      if (!data || typeof data !== 'object') return

      if (data.type === 'init') {
        window.clearTimeout(timeoutId)
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

/**
 * Ask the shell to navigate back. Inside the sandboxed iframe the browser
 * silently no-ops history.back() because the iframe has an opaque origin and
 * no real history entries (every push was relayed to the top window via
 * installShellNavigationSync). The shell calls history.back() on the top
 * window, which pops the real entry and the popstate handler re-renders the
 * iframe at the previous path.
 */
export function shellNavigateBack(): void {
  if (!isInShell()) {
    window.history.back()
    return
  }
  window.parent.postMessage({ type: 'navigate-back' }, '*')
}

/** Send a cross-app navigation event to the shell */
export function shellNavigateExternal(url: string): void {
  if (!isInShell()) {
    window.location.href = url
    return
  }
  window.parent.postMessage({ type: 'navigate-external', url }, '*')
}

/**
 * Navigate the top-level window to an arbitrary URL (e.g. an OAuth consent
 * page on another origin). Required when the iframe can't navigate itself
 * because the destination refuses to load in frames (X-Frame-Options).
 */
export function shellNavigateTop(url: string): void {
  if (!isInShell()) {
    window.location.href = url
    return
  }
  window.parent.postMessage({ type: 'navigate-top', url }, '*')
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

/** Notify the shell whether the current app has a sidebar at all.
 * When false, the shell menu should render horizontally regardless of the
 * persisted collapse state. */
export function shellSetSidebarPresent(present: boolean): void {
  if (isInShell()) {
    window.parent.postMessage({ type: 'sidebar-present', present }, '*')
  }
}

/** Broadcast locale preference changes to the shell (which forwards to all iframes) */
export function shellSetLocale(locale: LocalePreferences): void {
  if (isInShell()) {
    window.parent.postMessage({ type: 'locale-set', locale }, '*')
  }
}

/**
 * Broadcast a language change to the shell, which forwards a 'language-change'
 * message to all open iframes. Each app's I18nProvider listens for it and
 * activates the matching Lingui catalog without a full page reload.
 */
export function shellSetLanguage(language: string): void {
  if (isInShell()) {
    window.parent.postMessage({ type: 'language-set', language }, '*')
  }
}

/** Write text to the clipboard. Uses the shell proxy when sandboxed. */
let clipboardIdCounter = 0
const clipboardCallbacks = new Map<number, (ok: boolean) => void>()

function fallbackExecCommandCopy(text: string): boolean {
  if (typeof document === 'undefined' || !document.body) return false
  if (typeof document.execCommand !== 'function') return false

  const textArea = document.createElement('textarea')
  const activeElement = document.activeElement instanceof HTMLElement
    ? document.activeElement
    : null
  const selection = document.getSelection()
  const selectedRange =
    selection && selection.rangeCount > 0 ? selection.getRangeAt(0).cloneRange() : null

  textArea.value = text
  textArea.setAttribute('readonly', '')
  textArea.style.position = 'fixed'
  textArea.style.left = '-999999px'
  textArea.style.top = '-999999px'
  document.body.appendChild(textArea)

  textArea.focus()
  textArea.select()

  try {
    return document.execCommand('copy')
  } catch {
    return false
  } finally {
    document.body.removeChild(textArea)

    if (selection) {
      selection.removeAllRanges()
      if (selectedRange) {
        selection.addRange(selectedRange)
      }
    }

    activeElement?.focus()
  }
}

export function shellClipboardWrite(text: string): Promise<boolean> {
  // Outside shell, use native API directly
  if (!isInShell()) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      return navigator.clipboard.writeText(text).then(() => true, () => fallbackExecCommandCopy(text))
    }
    return Promise.resolve(fallbackExecCommandCopy(text))
  }

  // In shell (sandboxed iframe, opaque origin): the Clipboard API is blocked,
  // and routing through the parent via postMessage loses the click's transient
  // user activation by the time the parent calls navigator.clipboard.writeText
  // — Chromium 122+ rejects the write. document.execCommand('copy') still
  // works in sandboxed iframes (no origin / permission policy gate) and runs
  // synchronously inside the click handler where activation is still live.
  if (fallbackExecCommandCopy(text)) return Promise.resolve(true)

  // execCommand failed (rare — usually means no document.body or a browser
  // that disabled it). Fall back to the parent proxy as a best effort.
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

/**
 * Run a WebAuthn create/get ceremony via the parent shell. The sandboxed
 * iframe has an opaque origin so navigator.credentials.create/.get
 * throws NotAllowedError immediately. The shell runs in the top window
 * with a real origin and forwards the result back over postMessage.
 *
 * Outside the shell, calls navigator.credentials directly using the
 * native JSON parsers — same result shape so callers don't branch.
 */
let webauthnIdCounter = 0
const webauthnCallbacks = new Map<
  number,
  (result: { credential?: unknown; error?: { name: string; message: string } }) => void
>()

type WebauthnError = Error & { name: string }

function webauthnFailure(name: string, message: string): WebauthnError {
  const err = new Error(message) as WebauthnError
  err.name = name
  return err
}

async function webauthnLocal(create: boolean, optionsJSON: unknown): Promise<unknown> {
  const pk = window.PublicKeyCredential as unknown as {
    parseCreationOptionsFromJSON?: (opts: unknown) => PublicKeyCredentialCreationOptions
    parseRequestOptionsFromJSON?: (opts: unknown) => PublicKeyCredentialRequestOptions
  } | undefined
  if (!pk) throw webauthnFailure('NotSupportedError', 'WebAuthn unavailable in this browser')
  const publicKey = create
    ? pk.parseCreationOptionsFromJSON?.(optionsJSON)
    : pk.parseRequestOptionsFromJSON?.(optionsJSON)
  if (!publicKey) throw webauthnFailure('NotSupportedError', 'WebAuthn JSON parsers unavailable')
  const cred = create
    ? await navigator.credentials.create({ publicKey: publicKey as PublicKeyCredentialCreationOptions })
    : await navigator.credentials.get({ publicKey: publicKey as PublicKeyCredentialRequestOptions })
  const withToJSON = cred as unknown as { toJSON?: () => unknown }
  if (!cred || typeof withToJSON.toJSON !== 'function') {
    throw webauthnFailure('NotSupportedError', 'Credential JSON serialisation unavailable')
  }
  return withToJSON.toJSON()
}

function webauthnThroughShell(create: boolean, optionsJSON: unknown): Promise<unknown> {
  const id = ++webauthnIdCounter
  return new Promise((resolve, reject) => {
    webauthnCallbacks.set(id, (result) => {
      if (result.error) {
        reject(webauthnFailure(result.error.name, result.error.message))
        return
      }
      resolve(result.credential)
    })
    window.parent.postMessage(
      { type: create ? 'webauthn.create' : 'webauthn.get', requestId: id, optionsJSON },
      '*'
    )
  })
}

export function shellWebauthnCreate(optionsJSON: unknown): Promise<unknown> {
  return isInShell() ? webauthnThroughShell(true, optionsJSON) : webauthnLocal(true, optionsJSON)
}

export function shellWebauthnGet(optionsJSON: unknown): Promise<unknown> {
  return isInShell() ? webauthnThroughShell(false, optionsJSON) : webauthnLocal(false, optionsJSON)
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

    // External links — force new tab so they don't load inside the shell iframe
    if (href.startsWith('http://') || href.startsWith('https://')) {
      target.setAttribute('target', '_blank')
      target.setAttribute('rel', 'noopener noreferrer')
      return
    }

    // Only intercept absolute-path links to other apps
    if (!href.startsWith('/')) return

    const linkApp = href.match(/^\/([^/]+)/)?.[1] || ''
    if (!linkApp || linkApp === currentApp || linkApp.startsWith('_')) return

    if (event.ctrlKey || event.metaKey || event.shiftKey || event.button !== 0) return

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

  const origReplaceState = history.replaceState.bind(history)

  // Relay to the shell, distinguishing a push (new history entry) from a
  // replace (in-place URL update, no new entry). The shell owns the real
  // top-window history; if it can't tell the two apart it pushes for both, so
  // every router URL-canonicalization, filter replaceState, and the
  // replaceState TanStack fires when the iframe reloads on back injects a
  // spurious back-stack entry. Those bury the app-home entry and make
  // browser-back skip it (e.g. listing -> back lands on the Home app, not the
  // app's own home).
  const notifyShell = (replace: boolean) => {
    const path = window.location.pathname + window.location.search + window.location.hash
    window.parent.postMessage({ type: 'navigate', path, replace }, '*')
  }

  // In-shell, the top window owns the real back-stack; the iframe must NOT grow
  // its own (opaque-origin) session history or those phantom entries interleave
  // with the shell's and make browser-back skip/repeat. So mirror BOTH push and
  // replace locally with origReplaceState (update the current entry in place,
  // never add one) — TanStack drives rendering from its own internal location,
  // not the iframe URL — and let only the relayed flag tell the shell whether
  // to push or replace the one authoritative entry.
  history.pushState = function (...args: Parameters<typeof history.pushState>) {
    origReplaceState(...args)
    notifyShell(false)
  }

  history.replaceState = function (...args: Parameters<typeof history.replaceState>) {
    origReplaceState(...args)
    notifyShell(true)
  }

  // popstate (back/forward within the iframe) moves an existing entry — mirror
  // it as a replace so it never adds a new top-window entry.
  window.addEventListener('popstate', () => notifyShell(true))
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
    // Only accept messages from the shell (our direct parent). In top-window
    // contexts window.parent === window, so self-posted messages still pass;
    // this blocks injection from siblings, popups, or embedded frames.
    if (event.source !== window.parent) return
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

    // Handle WebAuthn ceremony result
    if (data.type === 'webauthn.create.result' || data.type === 'webauthn.get.result') {
      const cb = webauthnCallbacks.get(data.requestId as number)
      if (cb) {
        webauthnCallbacks.delete(data.requestId as number)
        cb({
          credential: data.credential,
          error: data.error as { name: string; message: string } | undefined,
        })
      }
    }

    // Route to all registered listeners
    for (const listener of messageListeners) {
      listener(data as ShellMessage)
    }
  })
}
