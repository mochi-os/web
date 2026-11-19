// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: Apache-2.0

import { useQuery } from '@tanstack/react-query'
import { rewritesPath } from '../lib/http'
import { getShellInitData, isInShell, isOwnResource } from '../lib/shell-bridge'
import { isSameOriginResource } from '../lib/safe-navigation'
import { shellGet } from '../lib/shell-fetch'

export type Style = { accent?: string }

// A style answer, with or without the {"data": ...} envelope, reduced to the
// one field a page may use.
function style(body: unknown): Style {
  const value =
    body && typeof body === 'object' && 'data' in body
      ? (body as { data: unknown }).data
      : body
  const accent =
    value && typeof value === 'object'
      ? (value as { accent?: unknown }).accent
      : undefined
  return typeof accent === 'string' ? { accent } : {}
}

/**
 * Fetches an entity's style from `url`. The address is built from what a row
 * says - often another server's row - so it carries no credential that runs
 * actions. Inside the shell it carries the read-only asset token, which core
 * honours only on the routes that serve assets (and on another app's only
 * where that route is shared, as people's style is), as an image is fetched
 * (shell-image.ts); a shell too old to hand one gives this app's own
 * resources the app token, as authenticatedUrl does, and others nothing.
 * Outside the shell it carries the page's session, which a GET can only spend
 * on an action marked as a read. An address on another origin, or one a URL
 * would rewrite on the way, is not fetched at all.
 */
export async function fetchStyle(url: string): Promise<Style> {
  let absolute: string
  try {
    absolute = new URL(url, document.baseURI).href
  } catch {
    return {}
  }
  if (rewritesPath(url) || !isSameOriginResource(absolute)) return {}
  try {
    if (isInShell()) {
      const init = getShellInitData()
      const own = isOwnResource(absolute)
      const token = init?.asset || (own ? init?.token : undefined)
      const headers: Array<[string, string]> = token
        ? // eslint-disable-next-line lingui/no-unlocalized-strings -- an HTTP header name
          [['Authorization', `Bearer ${token}`]]
        : []
      // The shell carries only this app's own addresses.
      const reply = own
        ? await shellGet(absolute, headers, { revalidate: true })
        : null
      if (reply) {
        if (reply.status !== 200) return {}
        return style(JSON.parse(new TextDecoder().decode(reply.body)))
      }
      const carried: RequestInit = {
        headers: Object.fromEntries(headers),
        credentials: 'omit',
      }
      const direct = await fetch(absolute, carried) // method-ok: fetchStyle itself; the gate scans its callers
      return direct.ok ? style(await direct.json()) : {}
    }
    const session: RequestInit = { credentials: 'same-origin' }
    const response = await fetch(absolute, session) // method-ok: fetchStyle itself; the gate scans its callers
    return response.ok ? style(await response.json()) : {}
  } catch {
    return {}
  }
}

// Fetches and parses the entity's style from `url`, an action on the CALLING
// app that proxies the person's style. There is no fallback to the people
// app: a cross-app request from the shell's sandboxed iframe carries no
// cookies and answers 403, and outside the shell it is a request this app
// has no business making.
export function useAccent(url?: string | null): Style {
  const { data } = useQuery<Style>({
    queryKey: ['accent', url],
    queryFn: () => (url ? fetchStyle(url) : Promise.resolve({})),
    enabled: !!url,
    staleTime: 5 * 60 * 1000,
  })
  return data ?? {}
}
