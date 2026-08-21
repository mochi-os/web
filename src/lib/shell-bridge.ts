// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: Apache-2.0

// Shell bridge: communication between sandboxed iframe apps and the shell page.
// When an app runs inside the shell's sandboxed iframe, it has an opaque origin
// and cannot access cookies, localStorage, or the parent DOM. All communication
// happens via postMessage.

import { isSameOriginResource } from './safe-navigation'

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

// What a theme is allowed to install. A theme arrives over postMessage from an
// app we do not trust, so these three rules decide what survives; the server's
// themes_validate applies the same ones at manifest ingestion.

/** A CSS custom property name — the only key shape a theme may set. */
export function isThemeProperty(name: string): boolean {
  return /^--[A-Za-z0-9_-]+$/.test(name)
}

/**
 * A theme value that would make the browser fetch. Custom properties are
 * consumed in image contexts, so a URL-bearing value beacons every page view.
 * Backslash and comment syntax count: `\75rl(` is `url(`.
 */
export function isFetchingValue(value: string): boolean {
  return /url|image|src|element|cross-fade|paint|\\|\/\*/i.test(value)
}

/**
 * font-size, the one standard property a theme carries. Bounded rather than
 * passed through: any app can post a theme, and 0.01% hides every app's
 * content.
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
   * BCP 47 language tag for the active catalog: the user's `language`
   * preference, else the request's Accept-Language, else "en".
   */
  language?: string | null
  /**
   * Source server URL when this account arrived by a server-move restore, with
   * the third-party services to re-link. Absent for normally-created accounts.
   */
  restoreSource?: string | null
  relinks?: { service: string; identifier: string }[] | null
  /**
   * True when the restored account had passkeys on the source server. Passkeys
   * are bound to their origin and do not travel in a backup.
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
    // Resolve after 5s so nothing hangs on a shell that will not answer, but
    // keep the listener: the shell's own ready watchdog is 10s, so init
    // legitimately arrives after we have given up.
    const timeoutId = window.setTimeout(() => {
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
      if (data.type !== 'init') return

      window.clearTimeout(timeoutId)
      if (shellInitData) {
        // Late arrival: callers hold the placeholder object resolved above, so
        // fill it in place rather than replacing the reference. Token refresh
        // relies on the same in-place update.
        Object.assign(shellInitData, data)
      } else {
        shellInitData = data as ShellInitData
      }
      // A no-op once settled, which is what makes the late path safe.
      resolve(shellInitData)
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


/**
 * Ask the shell to navigate back. history.back() silently no-ops in the
 * sandboxed iframe, which has no real history entries - every push was relayed
 * to the top window, and the shell pops it there.
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
 * Open a genuinely off-origin URL in a new tab. Not shellNavigateExternal: that
 * one crosses between Mochi apps, and the shell silently drops anything off its
 * own origin.
 */
export function shellOpenExternal(url: string): boolean {
  return window.open(url, '_blank', 'noopener,noreferrer') !== null
}

/**
 * Navigate the top-level window to an arbitrary URL. Needed when the
 * destination refuses to load in a frame (X-Frame-Options), such as an OAuth
 * consent page.
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

/** Ask the shell to hide its chrome for an immersive view. Repeated `on: true`
 * messages are a heartbeat the shell watchdogs, so a crashed app cannot leave
 * the
 * menu hidden. Prefer the `useShellImmersive` hook. */
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
 * Broadcast a language change; the shell forwards 'language-change' to every
 * iframe and each I18nProvider activates the catalog without a reload.
 */
export function shellSetLanguage(language: string): void {
  if (isInShell()) {
    window.parent.postMessage({ type: 'language-set', language }, '*')
  }
}

/**
 * Announce that a person's avatar changed. The avatar URL never changes and is
 * cached for five minutes, so the menus need a fresh version token. Posted
 * outside the shell too, where window.parent is the window itself.
 */
export function shellSetAvatar(person: string, version: string): void {
  window.parent.postMessage({ type: 'avatar-set', person, version }, '*')
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
  // Append inside the open modal dialog rather than document.body: a Radix
  // Dialog traps focus in its content scope, and a textarea outside it loses
  // focus, so execCommand('copy') returns true having copied nothing.
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

  // In the shell the Clipboard API is blocked, and a postMessage round trip
  // loses the click's transient activation, which Chromium 122+ rejects.
  // execCommand('copy') is not origin-gated and runs inside the click handler.
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
 * Trigger a file download. The sandboxed iframe silently refuses to save, so
 * the parent shell does it. Resolves false if the download could not be
 * started.
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
    // A shell page that predates the download channel never answers, and a
    // promise that never settles leaves the caller's spinner up for good.
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
    window.parent.postMessage({ type: 'download', url: absolute, name, id }, '*')
  })
}

/**
 * Save an in-memory Blob as `name`. Inside the shell the anchor click is
 * silently ignored, so the Blob is structured-cloned to the parent and saved
 * there. Resolves false if the save could not be started, a stale shell
 * included.
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
 * Route navigator.clipboard.writeText through the shell proxy, so existing
 * calls work in the sandboxed iframe unchanged.
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
 * Run a WebAuthn ceremony through the parent shell: the iframe's opaque origin
 * makes navigator.credentials throw NotAllowedError. Outside the shell it calls
 * navigator.credentials directly, with the same result shape.
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
 * Microphone recording via the top-level shell: opaque-origin iframes cannot
 * use getUserMedia, so the shell records and returns a Blob. Outside the shell,
 * use createMicSessionHost.
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
 * Intercept cross-app <a> clicks and route them through shellNavigateExternal:
 * the iframe cannot navigate cross-app itself, as it sends no cookies.
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
 * Relay history.pushState and replaceState to the shell, so the top-window URL
 * follows client-side navigation inside the iframe.
 */
let navigationSyncInstalled = false
export function installShellNavigationSync(): void {
  if (navigationSyncInstalled || !isInShell()) return
  navigationSyncInstalled = true

  const origReplaceState = history.replaceState.bind(history)

  // Distinguish push from replace: the shell owns the real top-window history,
  // and pushing for both turns every URL canonicalization and filter
  // replaceState into a back-stack entry that buries the app's own home.
  const notifyShell = (replace: boolean) => {
    // Shed the shell's private _shell marker: the relayed path re-enters the
    // iframe src from the top history, where re-tagging plus the router's
    // search serialization nests duplicate keys.
    const params = new URLSearchParams(window.location.search)
    params.delete('_shell')
    const query = params.toString()
    const path =
      window.location.pathname + (query ? `?${query}` : '') + window.location.hash
    window.parent.postMessage({ type: 'navigate', path, replace }, '*')
  }

  // Mirror both push and replace locally with origReplaceState: the iframe must
  // not grow its own session history, or those entries interleave with the
  // shell's and make browser-back skip. Only the relayed flag decides push or
  // replace.
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
 * Add the auth token to a resource URL as a query parameter: <img src> and <a
 * href> in a sandboxed iframe send neither headers nor cookies. Unchanged
 * outside the shell.
 */
export function authenticatedUrl(url: string): string {
  if (!isInShell() || !shellInitData || !url) return url

  // Resolve before deciding rather than pattern-matching the string: a
  // protocol-relative URL ("//host/path") names another origin without a
  // scheme, and a "starts with http(s)://" test would hand it the token.
  if (!isSameOriginResource(url)) return url

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
  // Only the shell can show this dialog. In the top window window.parent is
  // window itself, so the message would be posted to a document with no
  // handler and the promise would never settle - denied is both the honest
  // answer and the safe one.
  if (!isInShell()) return Promise.resolve('denied')
  const id = ++permissionIdCounter
  return new Promise((resolve) => {
    // Generous, because a real person has to read the dialog and decide; the
    // point is only that a shell which never answers cannot hang the caller.
    const timer = setTimeout(() => {
      if (permissionCallbacks.has(id)) {
        permissionCallbacks.delete(id)
        resolve('denied')
      }
    }, 120000)
    permissionCallbacks.set(id, ((result: string) => {
      clearTimeout(timer)
      resolve(result as 'granted' | 'denied')
    }) as (r: string) => void)
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
