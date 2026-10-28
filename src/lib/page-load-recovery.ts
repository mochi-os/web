// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: Apache-2.0

// Recovery for a page whose code failed to load. A page's code-split chunk
// that fails to download (a network drop, a server restart, a deploy that
// removed the old files) is remembered by lazyRouteComponent for the life of
// the document, so neither Try again nor a later click fetches it again.
// TanStack's own answer is one reload, guarded by a sessionStorage key. In the
// shell's sandboxed iframe that storage either throws, or is the server's
// in-memory stand-in (apps/menu/web/public/iframe-shim.js), which a reload
// empties, so TanStack reloads for ever on a blank page. It also only covers
// the browsers' module messages, not a stylesheet the chunk depends on. Here
// any such failure reloads the document once, which starts a fresh module map.

import type { AnyRouter } from '@tanstack/react-router'

// The browsers' messages for a dynamic import that could not be fetched, and
// Vite's for a stylesheet a page chunk depends on
/* eslint-disable lingui/no-unlocalized-strings -- browser and Vite error
   messages matched verbatim, not text the user sees */
const LOAD_FAILURES = [
  'Failed to fetch dynamically imported module',
  'error loading dynamically imported module',
  'Importing a module script failed',
  'Unable to preload CSS for',
]
/* eslint-enable lingui/no-unlocalized-strings */

// Put on the address of a page loaded again by this recovery: the page has had
// its reload. A reload of the shell's frame keeps the address and loses the
// history state. An earlier version kept this mark in the state, and a page
// whose code kept failing reloaded about once a second.
export const RELOAD_PARAM = '_reload'
// Kept on the address of a shell frame, for a server that cannot tell a frame
// load by its Sec-Fetch-Dest header
const SHELL_PARAM = '_shell'

// The sessionStorage key prefix TanStack's lazyRouteComponent marks its one
// reload with
const TANSTACK_RELOAD = 'tanstack_router_reload:'

// Inside the shell, make TanStack's reload read as spent. The iframe shim's
// storage forgets the mark on reload, and TanStack reloads while suspended, so
// no error reaches defaultOnCatch and the page reloads for ever. Read as spent,
// the failed import throws to the error boundary and is loaded again below.
// A real Storage keeps the mark across a reload, so it is left alone (setting
// a property on one stores an item), and so is a storage that throws:
// TanStack's reload cannot run there. Returns a function that puts the storage
// back.
function spendTanStackReload(): () => void {
  let storage: { getItem(key: string): string | null }
  try {
    storage = window.sessionStorage
  } catch {
    return () => {}
  }
  if (!storage || storage instanceof Storage) return () => {}
  const getItem = storage.getItem
  storage.getItem = function (key: string) {
    if (String(key).startsWith(TANSTACK_RELOAD)) return '1'
    return getItem.call(this, key)
  }
  return () => {
    storage.getItem = getItem
  }
}

function isLoadFailure(error: unknown): boolean {
  const message = (error as { message?: unknown } | null)?.message
  return (
    typeof message === 'string' &&
    LOAD_FAILURES.some((start) => message.startsWith(start))
  )
}

// True when the error comes from page code that did not load. Inside the
// sandbox the router is handed the SecurityError from the sessionStorage read
// instead, so the pages in view are asked: a failed one keeps its rejected
// load, and asking a loaded one again only hits the module cache.
async function pageCodeFailed(
  router: AnyRouter,
  error: unknown
): Promise<boolean> {
  if (isLoadFailure(error)) return true
  const loads = router.state.matches
    .map((match) => router.routesById[match.routeId]?.options.component)
    .map((component) => component?.preload?.())
    .filter(Boolean)
  const results = await Promise.allSettled(loads)
  return results.some((result) => result.status === 'rejected')
}

function trimSlash(path: string): string {
  return path.replace(/\/+$/, '') || '/'
}

// The browser address of the page in view, from the router: WebKit leaves the
// shell frame's own address behind as the app navigates.
function pageAddress(router: AnyRouter): URL {
  return new URL(
    router.history.createHref(router.state.location.publicHref),
    window.location.href
  )
}

// Watch the router for a page whose code failed to load and load it again
// once. Call once after createRouter; returns a function that stops watching.
export function startPageLoadRecovery(router: AnyRouter): () => void {
  const previous = router.options.defaultOnCatch
  // Read before the router moves the address: the path this document was
  // loaded again for, if it was. A failure there shows the error screen, so a
  // page that keeps failing loads twice at most.
  const loaded = new URL(window.location.href)
  const reloadedFor = loaded.searchParams.has(RELOAD_PARAM)
    ? trimSlash(loaded.pathname)
    : undefined
  const shellFrame = loaded.searchParams.has(SHELL_PARAM)

  const reload = () => {
    const page = pageAddress(router)
    if (trimSlash(page.pathname) === reloadedFor) return
    page.searchParams.set(RELOAD_PARAM, '1')
    if (shellFrame) page.searchParams.set(SHELL_PARAM, '1')
    window.location.replace(page.href)
  }

  // The page that failed while offline, loaded again when the network returns
  let waiting: string | undefined
  // Only while the failed page is still in view: offline, the user may have
  // moved on to a page that works, and reloading it loses what they typed
  const online = () => {
    const failed = waiting
    waiting = undefined
    if (router.state.location.href === failed) reload()
  }
  const recover = () => {
    if (navigator.onLine !== false) return reload()
    waiting = router.state.location.href
    window.addEventListener('online', online, { once: true })
  }

  const onCatch: typeof previous = (error, info) => {
    previous?.(error, info)
    void pageCodeFailed(router, error).then((failed) => {
      if (failed) recover()
    })
  }
  router.options.defaultOnCatch = onCatch
  const restoreStorage = spendTanStackReload()

  return () => {
    restoreStorage()
    window.removeEventListener('online', online)
    if (router.options.defaultOnCatch === onCatch)
      router.options.defaultOnCatch = previous
  }
}
