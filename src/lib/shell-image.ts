// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: Apache-2.0

// Images through the shell.
//
// Inside the shell's sandboxed frame the page's origin is opaque, and the
// browser's HTTP cache neither stores nor serves anything for it, so every
// image was downloaded again on every page view. Each also carried the
// half-hour asset token in its URL (authenticatedUrl), which changes on every
// load. The shell page shares the server's origin and its cache works, so an
// image of this app's own is fetched through it (shell-fetch.ts), with the
// asset token in a header and none in the URL, and shown from the bytes it
// hands back. The asset token and not the app token: core honours it only on
// the actions that serve assets, and only to read, so an image address a page
// author chose - a markdown image naming one of the app's own actions - runs
// nothing as the reader. Each use is revalidated, as the address no longer
// differs per account. Anything the shell will not carry - another app's
// image, an older shell, an SVG, a refusal - loads as before.

import { useEffect, useState } from 'react'
import { getShellInitData, isInShell, isOwnResource } from './shell-bridge'
import { shellGet } from './shell-fetch'

// How long an image no element shows stays in memory, for the element that
// comes back - a row scrolled away and back, a dialog reopened.
const LINGER = 60_000

/**
 * The address the shell fetches an image at, or null when the page loads it
 * itself: this app's own URL, made absolute, with any token taken out of it.
 */
export function carriedImage(src: string): string | null {
  if (!isInShell() || getShellInitData()?.fetch !== true) return null
  if (!getShellInitData()?.asset) return null
  let url: URL
  try {
    url = new URL(src, document.baseURI)
  } catch {
    return null
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return null
  if (!isOwnResource(url.href)) return null
  url.searchParams.delete('token')
  return url.href
}

// What the shell brought back for an address.
type Outcome = {
  // The object URL of the image's bytes, or null to load it directly.
  object: string | null
  // The server has no image there, or could not reach the peer that has it.
  // Kept like an image, so a list of people without avatars does not ask for
  // each one again every time a row, a filter or a picker remounts.
  missing: boolean
}

type Entry = {
  users: number
  result: Promise<Outcome>
  ready?: Outcome
  timer?: ReturnType<typeof setTimeout>
}

const entries = new Map<string, Entry>()

// Raster images only. An SVG keeps its own address: the policy the server
// serves it under would not survive into an object URL.
const raster = /^image\/(?!svg)[\w.+-]+/i

const direct: Outcome = { object: null, missing: false }

// Not found, or the server failing. Any other refusal, a 401 or 403 from an
// asset token that expired before the shell sent its refresh, says nothing
// about the image, so it is not kept and the next element asks again.
function gone(status: number): boolean {
  return status === 404 || status === 410 || status >= 500
}

async function load(url: string): Promise<Outcome> {
  const token = getShellInitData()?.asset
  if (!token) return direct
  const reply = await shellGet(
    url,
    // eslint-disable-next-line lingui/no-unlocalized-strings -- an HTTP header name
    [['Authorization', `Bearer ${token}`]],
    { revalidate: true }
  )
  if (!reply) return direct
  if (gone(reply.status)) return { object: null, missing: true }
  if (reply.status !== 200) return direct
  const type =
    reply.headers.find(
      ([name]) => name.toLowerCase() === 'content-type'
    )?.[1] ?? ''
  if (!raster.test(type)) return direct
  return {
    object: URL.createObjectURL(new Blob([reply.body], { type })),
    missing: false,
  }
}

function acquire(url: string): Entry {
  let entry = entries.get(url)
  if (!entry) {
    const created: Entry = { users: 0, result: load(url) }
    void created.result.then((outcome) => {
      created.ready = outcome
      // Anything the shell did not carry is not kept: the next element to
      // show it tries again. An error from the server is kept, as above.
      if (!outcome.object && !outcome.missing && entries.get(url) === created)
        entries.delete(url)
    })
    entries.set(url, created)
    entry = created
  }
  entry.users++
  if (entry.timer !== undefined) {
    clearTimeout(entry.timer)
    entry.timer = undefined
  }
  return entry
}

function release(url: string, entry: Entry) {
  entry.users--
  if (entry.users > 0) return
  entry.timer = setTimeout(() => {
    if (entries.get(url) === entry) entries.delete(url)
    void entry.result.then(({ object }) => {
      if (object) URL.revokeObjectURL(object)
    })
  }, LINGER)
}

export type AssetImageState = {
  /** What the <img> shows: undefined while the shell fetches it. */
  src: string | undefined
  /** True while the shell is fetching it. */
  pending: boolean
  /**
   * True when the server answered the shell with an error. src is then the
   * address as given, so an <img> still fails and fires its error handler.
   */
  missing: boolean
  /** The <img>, which a lazy image watches for nearing the screen. */
  ref: (element: Element | null) => void
}

/**
 * The source an <img> shows for an address that may be this app's own image.
 * In the shell's frame that is an object URL of bytes the shell fetched, once
 * per address however many elements show it; anywhere else, and for anything
 * the shell does not carry, the address as given. Lazy, it fetches only once
 * the element nears the screen, as the browser's loading="lazy" does.
 */
export function useAssetImage(
  src: string | null | undefined,
  lazy = false
): AssetImageState {
  const url = src ? carriedImage(src) : null
  const [element, setElement] = useState<Element | null>(null)
  const [near, setNear] = useState(!lazy)
  const [shown, setShown] = useState<{
    url: string
    outcome: Outcome
  } | null>(null)

  useEffect(() => {
    if (!url || near || !element) return
    if (typeof IntersectionObserver === 'undefined') {
      setNear(true)
      return
    }
    // The distance Chrome starts a lazy image at on a fast connection.
    const observer = new IntersectionObserver(
      (records) => {
        if (records.some((record) => record.isIntersecting)) {
          setNear(true)
          observer.disconnect()
        }
      },
      { rootMargin: '1250px 0px' }
    )
    observer.observe(element)
    return () => observer.disconnect()
  }, [url, near, element])

  useEffect(() => {
    if (!url || !near) return
    let live = true
    const entry = acquire(url)
    void entry.result.then((outcome) => {
      if (live) setShown({ url, outcome })
    })
    return () => {
      live = false
      release(url, entry)
    }
  }, [url, near])

  const settled = { pending: false, missing: false, ref: setElement }
  if (!src) return { ...settled, src: undefined }
  if (!url) return { ...settled, src }
  const outcome = shown?.url === url ? shown.outcome : entries.get(url)?.ready
  if (outcome) {
    return { ...settled, src: outcome.object ?? src, missing: outcome.missing }
  }
  return { ...settled, src: undefined, pending: true }
}
