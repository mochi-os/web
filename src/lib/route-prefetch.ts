// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: Apache-2.0

// Speculative page-code prefetch. When the user shows intent to open a page
// (mouse rests on a link, a press starts, keyboard focus lands), import that
// page's code-split chunk ahead of the click.
//
// Only router.loadRouteChunk is called. It imports the route's lazy chunk and
// preloads its components; it never runs beforeLoad or a loader, so no API
// request leaves the browser. Router-level preload (defaultPreload: 'intent')
// stays off in every app: it runs loaders on hover, and the burst of requests
// from sweeping across a list is why it was turned off (chat 0f7f5fae).
//
// A failed import is swallowed here, but lazyRouteComponent remembers it, so
// the click that follows does not fetch again. startRoutePrefetch therefore
// starts page-load-recovery too, which reloads the page once when its code
// failed to load, whether early here or at the click. Skipping offline keeps
// such failures rare. A touch press prefetches at the click itself.

import type { AnyRouter } from '@tanstack/react-router'
import {
  isDomainEntityRouting,
  isEntitySegment,
  routerPathForHref,
} from './app-path'
import { startPageLoadRecovery } from './page-load-recovery'

// How long a mouse must rest on a link before its page is fetched, so that
// moving across a list or sidebar fetches nothing.
const HOVER_DELAY_MS = 80

// What can name a page: a link, or an element carrying data-prefetch
const PAGE_ELEMENTS = ['a[href]', '[data-prefetch]'].join(',')

interface NetworkInformation {
  saveData?: boolean
  effectiveType?: string
}

// False when fetching ahead would cost the user: data saver on, a 2G-class
// connection, offline, or a hidden tab. navigator.connection is Chromium only;
// elsewhere it is missing and only the other checks apply.
function prefetchAllowed(): boolean {
  if (typeof document !== 'undefined' && document.visibilityState === 'hidden')
    return false
  if (typeof navigator === 'undefined') return true
  if (navigator.onLine === false) return false
  const connection = (navigator as { connection?: NetworkInformation })
    .connection
  if (connection?.saveData) return false
  const type = connection?.effectiveType
  return type !== 'slow-2g' && type !== '2g'
}

// The element whose target page should be fetched: a link with an href, or an
// element that names a page with data-prefetch (a button that navigates).
// Anything inside data-no-prefetch is left alone.
function prefetchTarget(target: EventTarget | null): string | null {
  if (!(target instanceof Element)) return null
  const element = target.closest(PAGE_ELEMENTS)
  if (!element || element.closest('[data-no-prefetch]')) return null
  const page = element.getAttribute('data-prefetch')
  if (page) return page
  if (!(element instanceof HTMLAnchorElement)) return null
  if (element.hasAttribute('download')) return null
  if (element.target && element.target !== '_self') return null
  return element.href
}

function firstSegment(pathname: string): string {
  return pathname.split('/')[1] ?? ''
}

// True when a browser path belongs to this app. The router's basepath rewrite
// leaves a path outside the basepath as it is, so another app's path on this
// host could otherwise match one of this app's routes.
function insideApp(router: AnyRouter, pathname: string): boolean {
  // Compared as the basepath rewrite compares it: case-insensitive
  const base = router.basepath.replace(/^\/+|\/+$/g, '').toLowerCase()
  const path = pathname.toLowerCase()
  if (base) return path === '/' + base || path.startsWith('/' + base + '/')
  // Basepath "/". On a direct entity URL in the shell (/<entity>/...) this
  // app's routes all lead with the entity, and another app's path leads with
  // the app's name. A domain route has no entity in the path at all.
  if (isDomainEntityRouting()) return true
  if (!isEntitySegment(firstSegment(window.location.pathname))) return true
  return isEntitySegment(firstSegment(pathname))
}

// Fetch the code for the page an href leads to. The href is a browser path,
// the same one a link to that page carries, basepath included. Hrefs on
// another host, outside this app, or matching no route are ignored. Safe to
// call repeatedly: each router path is looked up once, and loadRouteChunk
// skips loaded chunks.
export function prefetchRoute(
  router: AnyRouter,
  href: string,
  done: Set<string> = new Set()
): void {
  if (!prefetchAllowed()) return
  let url: URL
  try {
    url = new URL(href, window.location.href)
  } catch {
    return
  }
  // window.location still names the real host inside the shell's sandboxed
  // iframe, where window.origin is "null"
  if (url.host !== window.location.host) return
  if (!insideApp(router, url.pathname)) return

  // Paths only: inside the sandbox the router's own origin is a placeholder,
  // and parseLocation applies the basepath rewrite to whatever it is given.
  // A domain entity route's history hides the fingerprint from hrefs; put it
  // back the way that history's own parse does before the router sees it.
  const routerPath = routerPathForHref(router.history, url.pathname)
  let pathname: string
  try {
    pathname = router.parseLocation({
      href: routerPath + url.search + url.hash,
      pathname: routerPath,
      search: url.search,
      hash: url.hash,
      state: { __TSR_index: 0, key: '', __TSR_key: '' },
    }).pathname
  } catch {
    return
  }
  if (done.has(pathname)) return
  done.add(pathname)

  const { matchedRoutes, foundRoute } = router.getMatchedRoutes(pathname)
  if (!foundRoute) return
  for (const route of matchedRoutes) {
    try {
      // undefined, not a promise, when a route has nothing left to load
      Promise.resolve(router.loadRouteChunk(route)).catch(() => {})
    } catch {
      // an importer that throws before it returns its promise
    }
  }
}

// Watch the document for intent to open a page and prefetch its code, and
// recover from a page whose code fails to load. Call once after createRouter;
// returns a function that stops both.
export function startRoutePrefetch(
  router: AnyRouter,
  root: Document = document
): () => void {
  const done = new Set<string>()
  let pending: ReturnType<typeof setTimeout> | undefined
  let pendingTarget: string | null = null

  const cancel = () => {
    if (pending !== undefined) clearTimeout(pending)
    pending = undefined
    pendingTarget = null
  }
  const now = (event: Event) => {
    const href = prefetchTarget(event.target)
    if (href) prefetchRoute(router, href, done)
  }

  const over = (event: PointerEvent) => {
    if (event.pointerType !== 'mouse') return
    const href = prefetchTarget(event.target)
    if (href === pendingTarget) return
    cancel()
    if (!href) return
    pendingTarget = href
    pending = setTimeout(() => {
      pending = undefined
      pendingTarget = null
      prefetchRoute(router, href, done)
    }, HOVER_DELAY_MS)
  }
  const out = (event: PointerEvent) => {
    if (prefetchTarget(event.relatedTarget) !== pendingTarget) cancel()
  }
  const press = (event: PointerEvent) => {
    // A middle, right or modified press opens a new tab or a menu, not this
    // page in this tab
    if (event.button !== 0) return
    if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return
    now(event)
  }

  root.addEventListener('pointerover', over)
  root.addEventListener('pointerout', out)
  root.addEventListener('pointerdown', press)
  root.addEventListener('focusin', now)
  const stopRecovery = startPageLoadRecovery(router)
  return () => {
    cancel()
    stopRecovery()
    root.removeEventListener('pointerover', over)
    root.removeEventListener('pointerout', out)
    root.removeEventListener('pointerdown', press)
    root.removeEventListener('focusin', now)
  }
}
