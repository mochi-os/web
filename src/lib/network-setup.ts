// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: Apache-2.0

// The way from an app to setting up an account on another network, and back.
// Where an app offers something on a network the server offers but the user
// has no account on, it shows that network with a Set up button. The button
// opens Settings › Networks at the network, and that page's back button
// returns to the app's page by the address the app hands it.
import { RELOAD_PARAM } from './page-load-recovery'

// A base no address on this server shares, to tell a path from an address
// that leaves the server (`//host`, `/\host`, one with a tab inside).
const base = 'http://local.invalid'

/**
 * A path on this server as a query parameter may carry it, or null for
 * anything else, so the parameter cannot send the browser off the server.
 */
export function localPath(value: string | null | undefined): string | null {
  if (!value || !value.startsWith('/')) return null
  let url: URL
  try {
    url = new URL(value, base)
  } catch {
    return null
  }
  if (url.origin !== base) return null
  return url.pathname + url.search + url.hash
}

/** Settings › Networks at a network, its back button returning to `back`. */
export function networkSetupPath(network: string, back: string): string {
  const params = new URLSearchParams({ network })
  const local = localPath(back)
  if (local) params.set('back', local)
  return `/settings/user/networks?${params.toString()}`
}

/** The page shown, as the address bar has it: without the shell's markers. */
export function pagePath(): string {
  const params = new URLSearchParams(window.location.search)
  params.delete('_shell')
  params.delete(RELOAD_PARAM)
  const query = params.toString()
  return window.location.pathname + (query ? `?${query}` : '')
}
