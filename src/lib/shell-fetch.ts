// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: Apache-2.0

// Requests carried by the shell.
//
// Inside the shell's sandboxed iframe the app's origin is opaque, so every
// request it sends to the server is cross-origin, and the app token's
// Authorization header makes each one need a CORS preflight. Browsers keep no
// preflight answer for an opaque origin, so every request paid an extra round
// trip. The shell page shares the server's origin and needs none, so this
// module asks it to make the request. The shell sends the request with this
// frame's own headers and no cookies, and only to this app's own URLs.
//
// A request the shell cannot carry goes direct, as before: one that reports
// progress or must outlive the page, a body that cannot cross postMessage, a
// URL outside this app, anything the shell refuses, and everything under a
// shell that predates the bridge.

import {
  buildURL,
  headerPairs,
  headerRecord,
  httpErrors,
  HttpError,
  sendDirect,
  settle,
  type HttpRequestConfig,
  type HttpResponse,
} from './http'
import {
  getShellInitData,
  isInShell,
  onShellMessage,
  shellOrigin,
} from './shell-bridge'

type Body =
  | string
  | Blob
  | ArrayBuffer
  | ArrayBufferView
  | { form: Array<[string, FormDataEntryValue]> }
  | undefined

type Carried = {
  url: string
  method: string
  headers: Array<[string, string]>
  body: Body
}

type Reply = {
  id: string
  refused?: boolean
  redirect?: boolean
  failed?: boolean
  status?: number
  statusText?: string
  headers?: Array<[string, string]>
  body?: ArrayBuffer
}

/* eslint-disable lingui/no-unlocalized-strings -- for the redirect a write
   met, which a direct request follows instead; never shown, since the write
   reached the server and normalizeError words the failure. */
const redirectMessage = 'Redirect not followed'
/* eslint-enable lingui/no-unlocalized-strings */

const waiting = new Map<string, (reply: Reply) => void>()

// A request id nobody else can guess. The shell answers the window that asked,
// and an app can navigate its frame to another app's page: with ids that
// count up, the first app's late answer would settle the second's request of
// the same number.
function identifier(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16))
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join(
    ''
  )
}
let listening = false

// A carried GET's progress callbacks, by request id.
const progressing = new Map<string, (received: number) => void>()

function listen() {
  if (listening) return
  listening = true
  onShellMessage((message) => {
    if (message.type === 'fetch.progress') {
      const report = progressing.get(message.id as string)
      if (report && typeof message.received === 'number')
        report(message.received)
      return
    }
    if (message.type !== 'fetch.result') return
    const id = message.id as string
    progressing.delete(id)
    const settle = waiting.get(id)
    if (!settle) return
    waiting.delete(id)
    settle(message as unknown as Reply)
  })
}

// The first path segment: the app a URL belongs to, as the shell judges it.
function segment(path: string): string {
  const match = /^\/([^/]+)/.exec(path)
  return match ? match[1] : ''
}

// The request as the shell takes it, or null when it must go direct. One
// that reports progress or must outlive the page goes direct: the shell
// reports neither upload progress nor a carried request's download, and a
// keepalive request has to be the browser's own.
function carried(config: HttpRequestConfig): Carried | null {
  if (config.onUploadProgress || config.onDownloadProgress || config.keepalive)
    return null

  const origin = shellOrigin()
  let url: URL
  try {
    url = new URL(buildURL(config), window.location.href)
  } catch {
    return null
  }
  const app = segment(new URL(window.location.href).pathname)
  if (!app || url.origin !== origin || segment(url.pathname) !== app)
    return null

  // Already encoded by prepareBody, which also dropped the Content-Type of a
  // request with no body or a form.
  const data: unknown = config.data
  let body: Body
  if (data === undefined || data === null) {
    body = undefined
  } else if (
    typeof data === 'string' ||
    data instanceof Blob ||
    data instanceof ArrayBuffer ||
    ArrayBuffer.isView(data)
  ) {
    body = data
  } else if (data instanceof FormData) {
    body = { form: Array.from(data.entries()) }
  } else {
    return null
  }

  return {
    url: url.href,
    method: (config.method ?? 'GET').toUpperCase(),
    headers: headerPairs(config.headers),
    body,
  }
}

function decode(
  buffer: ArrayBuffer,
  config: HttpRequestConfig,
  headers: Record<string, string>
): string | Blob | ArrayBuffer {
  if (config.responseType === 'arraybuffer') return buffer
  if (config.responseType === 'blob') {
    return new Blob([buffer], { type: headers['content-type'] ?? '' })
  }
  // settle parses JSON, as for a direct request.
  return new TextDecoder().decode(buffer)
}

// Straight to the server. Inside the shell no cookie can or should go: the
// frame's token is its only credential.
function direct(config: HttpRequestConfig): Promise<HttpResponse> {
  return sendDirect(config, { omitCredentials: isInShell() })
}

/**
 * Sends a prepared request (see prepareBody in http.ts): through the shell
 * page when this frame is in a shell that carries requests and the request is
 * one it takes, and straight to the server otherwise.
 */
export function shellAdapter(config: HttpRequestConfig): Promise<HttpResponse> {
  if (!isInShell() || getShellInitData()?.fetch !== true) return direct(config)
  const request = carried(config)
  if (!request) return direct(config)
  if (config.signal?.aborted) return Promise.reject(httpErrors.canceled(config))
  listen()

  return new Promise<HttpResponse>((resolve, reject) => {
    const id = identifier()
    let timer: ReturnType<typeof setTimeout> | undefined

    function done() {
      waiting.delete(id)
      if (timer !== undefined) clearTimeout(timer)
      config.signal?.removeEventListener('abort', onCanceled)
    }

    function abandon() {
      done()
      window.parent.postMessage({ type: 'fetch.abort', id }, shellOrigin())
    }

    function onCanceled() {
      abandon()
      reject(httpErrors.canceled(config))
    }

    waiting.set(id, (reply) => {
      done()
      const read = request.method === 'GET' || request.method === 'HEAD'
      // Refused before anything was sent, or a redirect the shell would not
      // follow on a read, which is safe to repeat: send it directly.
      if (reply.refused || (reply.redirect && read)) {
        direct(config).then(resolve, reject)
        return
      }
      if (reply.redirect) {
        // A write already reached the server, so it is not repeated.
        reject(new HttpError(redirectMessage, 'ERR_BAD_RESPONSE', config))
        return
      }
      if (reply.failed || typeof reply.status !== 'number') {
        reject(httpErrors.network(config))
        return
      }
      const headers = headerRecord(reply.headers ?? [])
      try {
        resolve(
          settle(
            config,
            reply.status,
            reply.statusText ?? '',
            headers,
            decode(reply.body ?? new ArrayBuffer(0), config, headers)
          )
        )
      } catch (error) {
        reject(error)
      }
    })

    if (config.timeout) {
      timer = setTimeout(() => {
        abandon()
        reject(httpErrors.timeout(config))
      }, config.timeout)
    }

    config.signal?.addEventListener('abort', onCanceled)

    try {
      window.parent.postMessage(
        {
          type: 'fetch',
          id,
          url: request.url,
          method: request.method,
          headers: request.headers,
          body: request.body,
        },
        shellOrigin()
      )
    } catch {
      // A body postMessage cannot clone: send it directly.
      done()
      direct(config).then(resolve, reject)
    }
  })
}

/** What the shell answered for a request it carried. */
export type ShellReply = {
  status: number
  headers: Array<[string, string]>
  body: ArrayBuffer
}

// How long a carried GET may go without a word from the shell before it is
// ended and answered null, so the caller loads the bytes itself: stall between
// reports of bytes received, which a download moving at all renews every tenth
// of a second, so a slow link's large download is ended only once it stops
// moving, not part-way through, to be fetched again by the frame outside any
// cache. Before the first report, patience, or for the whole answer from a
// shell that reports none; but stall for a caller that hears progress, which
// watches for movement itself (Air calls a load that shows none for 20 s
// stalled) and is answered in time to load the bytes on its own.
const patience = 60000
const stall = 15000

/**
 * A GET carried by the shell, outside the request client: for bytes the page shows or
 * uses rather than data it reads, such as an image or a model. The shell's
 * window keeps them in the browser's cache, which a sandboxed frame has none
 * of. Null when the shell will not carry it (a shell that predates the
 * bridge, a URL outside this app, a refusal, a redirect, a network failure,
 * or a shell gone quiet), and the caller then loads it itself. progress hears
 * the bytes received so far; a request that asks for it is carried only by a
 * shell that reports them, since one that does not shows a long download no
 * movement until it ends.
 */
export function shellGet(
  url: string,
  headers: Array<[string, string]>,
  options: {
    revalidate?: boolean
    progress?: (received: number) => void
  } = {}
): Promise<ShellReply | null> {
  const init = getShellInitData()
  if (!isInShell() || init?.fetch !== true) return Promise.resolve(null)
  if (options.progress && init.progress !== true) return Promise.resolve(null)
  listen()
  return new Promise((resolve) => {
    const id = identifier()
    const report = options.progress
    // A shell that reports progress is asked to for every request, whether
    // or not the caller listens: the reports are what keep it waiting.
    const reports = init.progress === true
    let heard = false
    let timer: ReturnType<typeof setTimeout> | undefined
    // Given up on: ended in the shell too, so it is not downloaded twice.
    function quiet() {
      waiting.delete(id)
      progressing.delete(id)
      try {
        window.parent.postMessage({ type: 'fetch.abort', id }, shellOrigin())
      } catch {
        // The shell has gone; nothing to end.
      }
      resolve(null)
    }
    function wait() {
      clearTimeout(timer)
      timer = setTimeout(quiet, heard || report ? stall : patience)
    }
    if (reports)
      progressing.set(id, (received) => {
        heard = true
        wait()
        report?.(received)
      })
    waiting.set(id, (reply) => {
      clearTimeout(timer)
      if (
        reply.refused ||
        reply.redirect ||
        reply.failed ||
        typeof reply.status !== 'number'
      ) {
        resolve(null)
        return
      }
      resolve({
        status: reply.status,
        headers: reply.headers ?? [],
        body: reply.body ?? new ArrayBuffer(0),
      })
    })
    try {
      window.parent.postMessage(
        {
          type: 'fetch',
          id,
          url,
          method: 'GET',
          headers,
          ...(options.revalidate ? { cache: 'no-cache' } : {}),
          ...(reports ? { progress: true } : {}),
        },
        shellOrigin()
      )
      wait()
    } catch {
      waiting.delete(id)
      progressing.delete(id)
      resolve(null)
    }
  })
}
