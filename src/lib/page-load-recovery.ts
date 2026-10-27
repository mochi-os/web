// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: Apache-2.0

// Recovery for a page whose code failed to load. A page's code-split chunk
// that fails to download (a network drop, a server restart, a deploy that
// removed the old files) is remembered by lazyRouteComponent for the life of
// the document, so neither Try again nor a later click fetches it again.
// TanStack's own answer is one reload, but it reads sessionStorage first,
// which throws in the shell's sandboxed iframe, and it only covers the
// browsers' module messages, not a stylesheet the chunk depends on. Here any
// such failure reloads the document once, which starts a fresh module map.

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

// Kept in the history entry's state, which survives a reload and needs no
// storage the sandbox forbids: the entry has had its one reload
const RELOADED = '__mochiPageReload'

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

function entryState(): Record<string, unknown> {
  return (window.history.state ?? {}) as Record<string, unknown>
}

// Reload once per history entry, so a page that keeps failing shows its error
// screen instead of reloading for ever. Offline, wait for the network first.
function reloadOnce() {
  const state = entryState()
  if (state[RELOADED]) return
  if (navigator.onLine === false) {
    window.addEventListener('online', reloadOnce, { once: true })
    return
  }
  window.history.replaceState({ ...state, [RELOADED]: true }, '')
  window.location.reload()
}

// Watch the router for a page whose code failed to load and reload once.
// Call once after createRouter; returns a function that stops watching.
export function startPageLoadRecovery(router: AnyRouter): () => void {
  const previous = router.options.defaultOnCatch
  // Whether the pages of the current load drew an error. Reset as a load
  // starts, since the pages draw, and throw, after it resolves.
  let caught = false
  let opened: ReturnType<typeof setTimeout> | undefined

  const onCatch: typeof previous = (error, info) => {
    previous?.(error, info)
    caught = true
    void pageCodeFailed(router, error).then((failed) => {
      if (failed) reloadOnce()
    })
  }
  router.options.defaultOnCatch = onCatch

  const stopLoad = router.subscribe('onBeforeLoad', () => {
    caught = false
  })

  // A page that opened clears the mark, so a later failure on the same entry
  // gets its reload too. Resolving is not opening: lazyRouteComponent swallows
  // a failed import or stylesheet while loading and throws it while drawing,
  // so the mark is cleared after the draw, and only when nothing was caught.
  // Cleared on resolve, the page would reload for as long as it kept failing.
  const stopResolved = router.subscribe('onResolved', () => {
    clearTimeout(opened)
    opened = setTimeout(() => {
      opened = undefined
      if (caught) return
      const state = entryState()
      if (!state[RELOADED]) return
      if (router.state.matches.some((match) => match.status === 'error')) return
      const { [RELOADED]: _, ...rest } = state
      window.history.replaceState(rest, '')
    })
  })

  return () => {
    window.removeEventListener('online', reloadOnce)
    clearTimeout(opened)
    if (router.options.defaultOnCatch === onCatch)
      router.options.defaultOnCatch = previous
    stopLoad()
    stopResolved()
  }
}
