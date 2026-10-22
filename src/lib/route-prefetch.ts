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
// A failed import is swallowed here, but lazyRouteComponent remembers it: the
// click that follows reloads the page once rather than retrying. Skipping
// offline keeps that to a network drop that clears between hover and click.

import type { AnyRouter } from '@tanstack/react-router'

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

// Fetch the code for the page an href leads to. Hrefs on another host, or
// that match no route in this app, are ignored. Safe to call repeatedly: each
// router path is looked up once, and loadRouteChunk skips loaded chunks.
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

  // Paths only: inside the sandbox the router's own origin is a placeholder,
  // and parseLocation applies the basepath rewrite to whatever it is given.
  // On an entity domain route createAppHistory hides the fingerprint from the
  // href, so the path may match a different route or none: the cost is a
  // wasted chunk or no prefetch, never a request for data.
  const path = url.pathname + url.search + url.hash
  let pathname: string
  try {
    pathname = router.parseLocation({
      href: path,
      pathname: url.pathname,
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
    // undefined, not a promise, when a route has nothing left to load
    Promise.resolve(router.loadRouteChunk(route)).catch(() => {})
  }
}

// Watch the document for intent to open a page and prefetch its code. Call
// once after createRouter; returns a function that stops watching.
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

  root.addEventListener('pointerover', over)
  root.addEventListener('pointerout', out)
  root.addEventListener('pointerdown', now)
  root.addEventListener('focusin', now)
  return () => {
    cancel()
    root.removeEventListener('pointerover', over)
    root.removeEventListener('pointerout', out)
    root.removeEventListener('pointerdown', now)
    root.removeEventListener('focusin', now)
  }
}
