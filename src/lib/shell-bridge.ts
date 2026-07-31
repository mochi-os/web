// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: Apache-2.0

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

// What a theme is allowed to install. A color theme arrives over postMessage
// from an app we don't trust — the shell relays whatever an app sends to every
// other app's iframe — so these three rules decide what survives. They are
// duplicated in apps/menu/web/public/shell.js (plain script, can't import) and
// in the server's themes_validate (Go, manifest ingestion); the parity test in
// shell-bridge.test.ts fails if the copies drift.

/** A CSS custom property name — the only key shape a theme may set. */
export function isThemeProperty(name: string): boolean {
  return /^--[A-Za-z0-9_-]+$/.test(name)
}

/**
 * A theme value that would make the browser fetch. Custom properties are
 * consumed in image contexts, so a URL-bearing value beacons every page view
 * to whoever supplied the theme. Backslash and comment syntax count: they let
 * a function name be written so it doesn't read as itself (`\75rl(` is `url(`).
 */
export function isFetchingValue(value: string): boolean {
  return /url|image|src|element|cross-fade|paint|\\|\/\*/i.test(value)
}

/**
 * font-size is the one standard property a theme state carries, set by the
 * settings font size preference. It is bounded rather than passed through:
 * any app can post a theme, and 0.01% hides every app's content as effectively
 * as display:none would.
 */
export function isThemeFontSize(value: string): boolean {
  if (!/^\d{2,3}(\.\d+)?%$/.test(value)) return false
  const size = parseFloat(value)
  return size >= 50 && size <= 200
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

/** Ask the shell to hide its chrome for an immersive view (e.g. a fullscreen
 * game). The shell treats repeated `on: true` messages as a heartbeat and
 * auto-restores its chrome if they stop, so a crashed or closed app can never
 * leave the menu permanently hidden. Prefer the `useShellImmersive` hook, which
 * sends the heartbeat and always restores on unmount. */
export function shellSetImmersive(on: boolean): void {
  if (isInShell()) {
    window.parent.postMessage({ type: 'immersive', on }, '*')
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
  // Append inside the open modal dialog (if any) rather than document.body. A
  // Radix Dialog traps focus in its content scope, so a textarea outside it
  // gets focus yanked straight back — leaving execCommand('copy') with nothing
  // selected (it returns true but copies the old clipboard). Inside the scope,
  // the textarea keeps focus and the copy works. Falls back to body elsewhere.
  const dialog =
    (activeElement &&
      activeElement.closest('[role="dialog"], [role="alertdialog"]')) ||
    document.querySelector(
      '[role="dialog"][data-state="open"], [role="alertdialog"][data-state="open"]'
    )
  const container = dialog || document.body
  container.appendChild(textArea)

  textArea.focus()
  textArea.select()

  try {
    return document.execCommand('copy')
  } catch {
    return false
  } finally {
    textArea.remove()

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

/** Anchor-click save — only works where this document is same-origin and not
 * sandboxed (the top window). */
function saveBlob(blob: Blob, name: string): void {
  const objectUrl = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = objectUrl
  a.download = name
  a.style.display = 'none'
  document.body.appendChild(a)
  a.click()
  // Delay cleanup so the browser resolves the blob URL before it's revoked.
  setTimeout(() => {
    document.body.removeChild(a)
    URL.revokeObjectURL(objectUrl)
  }, 1000)
}

/** Fetch a URL and save it to disk via a blob — only safe where this document
 * is same-origin and not sandboxed (the top window). */
function directBlobDownload(url: string, name: string): Promise<boolean> {
  return fetch(url, { credentials: 'same-origin' })
    .then((r) => {
      if (!r.ok) throw new Error(`HTTP ${r.status}`)
      return r.blob()
    })
    .then((blob) => {
      saveBlob(blob, name)
      return true
    })
    .catch(() => false)
}

/**
 * Trigger a real file download. Inside the shell's sandboxed (opaque-origin)
 * iframe the browser silently refuses to save — a bare <a download> is ignored
 * cross-origin and a blob click is blocked — so hand the job to the parent
 * shell, which is same-origin and unsandboxed. In the top window we can save
 * directly. Resolves false if the download couldn't be started.
 */
let downloadIdCounter = 0
const downloadCallbacks = new Map<number, (ok: boolean) => void>()

export function shellDownload(url: string, name: string): Promise<boolean> {
  // Resolve against this document's real app URL before the value leaves the
  // iframe, so the parent receives an unambiguous absolute URL.
  const absolute = new URL(url, document.baseURI).href
  if (!isInShell()) {
    return directBlobDownload(absolute, name)
  }
  const id = ++downloadIdCounter
  return new Promise((resolve) => {
    downloadCallbacks.set(id, resolve)
    window.parent.postMessage({ type: 'download', url: absolute, name, id }, '*')
  })
}

/**
 * Save an in-memory Blob to disk as `name`. In the top window a plain anchor
 * click works; inside the shell's sandboxed iframe the browser silently
 * ignores it, so post the Blob to the parent shell (structured cloning
 * carries it across the sandbox boundary) and let the unsandboxed top window
 * save it. Resolves false if the save couldn't be started — including a
 * stale shell page that predates the download.content channel (timeout).
 */
export function shellSaveBlob(blob: Blob, name: string): Promise<boolean> {
  if (!isInShell()) {
    saveBlob(blob, name)
    return Promise.resolve(true)
  }
  const id = ++downloadIdCounter
  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      if (downloadCallbacks.has(id)) {
        downloadCallbacks.delete(id)
        resolve(false)
      }
    }, 10000)
    downloadCallbacks.set(id, (ok) => {
      clearTimeout(timer)
      resolve(ok)
    })
    window.parent.postMessage({ type: 'download.content', blob, name, id }, '*')
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

/**
 * Microphone recording via the top-level Mochi shell.
 * Sandboxed opaque-origin iframes cannot use getUserMedia; the shell records
 * and returns a structured-cloneable Blob over postMessage.
 *
 * Outside the shell, callers should use createMicSessionHost locally instead.
 */

export type ShellMicResult = {
  blob: Blob
  mimeType: string
  filename: string
  durationSecs: number
}

export type ShellMicError = Error & { name: string }

const SHELL_MIC_START_TIMEOUT_MS = 30_000
const SHELL_MIC_STOP_TIMEOUT_MS = 120_000
const SHELL_MIC_CANCEL_TIMEOUT_MS = 30_000
const SHELL_MIC_PROBE_TIMEOUT_MS = 800
const SHELL_MIC_UNSUPPORTED =
  'Installed Mochi shell may not support voice recording'

function shellMicFailure(name: string, message: string): ShellMicError {
  const err = new Error(message) as ShellMicError
  err.name = name
  return err
}

let micIdCounter = 0
const micProbeCallbacks = new Map<
  number,
  {
    resolve: (supported: boolean) => void
    timer: ReturnType<typeof setTimeout>
  }
>()
const micStartCallbacks = new Map<
  number,
  {
    resolve: (requestId: number) => void
    reject: (err: ShellMicError) => void
    timer: ReturnType<typeof setTimeout>
  }
>()
const micStopCallbacks = new Map<
  number,
  {
    resolve: (result: ShellMicResult) => void
    reject: (err: ShellMicError) => void
    timer: ReturnType<typeof setTimeout>
  }
>()
const micCancelCallbacks = new Map<
  number,
  {
    resolve: () => void
    reject: (err: ShellMicError) => void
    timer: ReturnType<typeof setTimeout>
  }
>()

function clearMicTimer(
  entry: { timer: ReturnType<typeof setTimeout> } | undefined
) {
  if (entry) clearTimeout(entry.timer)
}

/**
 * Probe whether the parent shell implements the mic bridge.
 * Old shells ignore the message → false after a short timeout (no 30s hang).
 */
export function shellMicProbe(): Promise<boolean> {
  if (!isInShell()) {
    return Promise.resolve(false)
  }

  const requestId = ++micIdCounter
  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      micProbeCallbacks.delete(requestId)
      resolve(false)
    }, SHELL_MIC_PROBE_TIMEOUT_MS)

    micProbeCallbacks.set(requestId, { resolve, timer })
    window.parent.postMessage({ type: 'mic.probe', requestId }, '*')
  })
}

/** Start shell-side microphone recording. Resolves with shell requestId. */
export function shellMicStart(): Promise<number> {
  if (!isInShell()) {
    return Promise.reject(
      shellMicFailure(
        'InvalidStateError',
        'shellMicStart is only available inside the Mochi shell'
      )
    )
  }

  const requestId = ++micIdCounter
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      micStartCallbacks.delete(requestId)
      // Best-effort cancel so the shell discards a still-pending permission
      // request. Do not await shellMicCancel() — that adds another timeout.
      window.parent.postMessage({ type: 'mic.cancel', requestId }, '*')
      reject(shellMicFailure('TimeoutError', SHELL_MIC_UNSUPPORTED))
    }, SHELL_MIC_START_TIMEOUT_MS)

    micStartCallbacks.set(requestId, { resolve, reject, timer })
    window.parent.postMessage({ type: 'mic.start', requestId }, '*')
  })
}

/** Stop shell-side recording and receive the Blob result. */
export function shellMicStop(requestId: number): Promise<ShellMicResult> {
  if (!isInShell()) {
    return Promise.reject(
      shellMicFailure(
        'InvalidStateError',
        'shellMicStop is only available inside the Mochi shell'
      )
    )
  }

  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      micStopCallbacks.delete(requestId)
      reject(shellMicFailure('TimeoutError', SHELL_MIC_UNSUPPORTED))
    }, SHELL_MIC_STOP_TIMEOUT_MS)

    micStopCallbacks.set(requestId, { resolve, reject, timer })
    window.parent.postMessage({ type: 'mic.stop', requestId }, '*')
  })
}

/** Cancel shell-side recording (or a pending permission request). */
export function shellMicCancel(requestId?: number): Promise<void> {
  if (!isInShell()) {
    return Promise.resolve()
  }

  const id = requestId ?? 0
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      micCancelCallbacks.delete(id)
      reject(shellMicFailure('TimeoutError', SHELL_MIC_UNSUPPORTED))
    }, SHELL_MIC_CANCEL_TIMEOUT_MS)

    micCancelCallbacks.set(id, { resolve, reject, timer })
    window.parent.postMessage(
      { type: 'mic.cancel', requestId: requestId ?? null },
      '*'
    )
  })
}

type MicLevelListener = (requestId: number, level: number) => void
const micLevelListeners = new Set<MicLevelListener>()

/** Subscribe to live microphone level samples from the shell (0..1). */
export function onShellMicLevel(listener: MicLevelListener): () => void {
  micLevelListeners.add(listener)
  return () => {
    micLevelListeners.delete(listener)
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

    // Handle download result
    if (data.type === 'download.result') {
      const cb = downloadCallbacks.get(data.id as number)
      if (cb) {
        downloadCallbacks.delete(data.id as number)
        cb(data.ok as boolean)
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

    // Handle microphone bridge results from the shell
    if (data.type === 'mic.probe.result') {
      const requestId = data.requestId as number
      const cb = micProbeCallbacks.get(requestId)
      if (cb) {
        micProbeCallbacks.delete(requestId)
        clearMicTimer(cb)
        cb.resolve(data.supported === true)
      }
    }

    if (data.type === 'mic.started') {
      const requestId = data.requestId as number
      const cb = micStartCallbacks.get(requestId)
      if (cb) {
        micStartCallbacks.delete(requestId)
        clearMicTimer(cb)
        cb.resolve(requestId)
      }
    }

    if (data.type === 'mic.level') {
      const requestId = data.requestId as number
      const level = Number(data.level)
      if (Number.isFinite(level)) {
        for (const listener of micLevelListeners) {
          listener(requestId, level)
        }
      }
    }

    if (data.type === 'mic.result') {
      const requestId = data.requestId as number
      const startCb = micStartCallbacks.get(requestId)
      if (startCb) {
        micStartCallbacks.delete(requestId)
        clearMicTimer(startCb)
        const err = data.error as { name?: string; message?: string } | undefined
        startCb.reject(
          shellMicFailure(
            err?.name || (data.cancelled ? 'AbortError' : 'Error'),
            err?.message ||
              (data.cancelled
                ? 'Microphone request cancelled'
                : 'Microphone recording failed')
          )
        )
      }

      const stopCb = micStopCallbacks.get(requestId)
      if (stopCb) {
        micStopCallbacks.delete(requestId)
        clearMicTimer(stopCb)
        if (data.ok && data.blob instanceof Blob) {
          stopCb.resolve({
            blob: data.blob,
            mimeType: String(data.mimeType || 'audio/webm'),
            filename: String(data.filename || 'Voice Note.webm'),
            durationSecs: Number(data.durationSecs) || 1,
          })
        } else {
          const err = data.error as { name?: string; message?: string } | undefined
          stopCb.reject(
            shellMicFailure(
              err?.name || (data.cancelled ? 'AbortError' : 'Error'),
              err?.message ||
                (data.cancelled
                  ? 'Microphone recording cancelled'
                  : 'Microphone recording failed')
            )
          )
        }
      }

      const cancelCb =
        micCancelCallbacks.get(requestId) || micCancelCallbacks.get(0)
      if (cancelCb) {
        if (micCancelCallbacks.get(requestId)) {
          micCancelCallbacks.delete(requestId)
        } else {
          micCancelCallbacks.delete(0)
        }
        clearMicTimer(cancelCb)
        cancelCb.resolve()
      }
    }

    if (data.type === 'mic.cancelled') {
      const requestId = (data.requestId as number) || 0
      const cancelCb =
        micCancelCallbacks.get(requestId) || micCancelCallbacks.get(0)
      if (cancelCb) {
        if (micCancelCallbacks.get(requestId)) {
          micCancelCallbacks.delete(requestId)
        } else {
          micCancelCallbacks.delete(0)
        }
        clearMicTimer(cancelCb)
        cancelCb.resolve()
      }
    }

    // Route to all registered listeners
    for (const listener of messageListeners) {
      listener(data as ShellMessage)
    }
  })
}
