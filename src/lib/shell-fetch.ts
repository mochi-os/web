// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: Apache-2.0

// Requests carried by the shell.
//
// Inside the shell's sandboxed iframe the app's origin is opaque, so every
// request it sends to the server is cross-origin, and the app token's
// Authorization header makes each one need a CORS preflight. Browsers keep no
// preflight answer for an opaque origin, so every request paid an extra round
// trip. The shell page shares the server's origin and needs none, so this
// adapter asks it to make the request. The shell sends the request with this
// frame's own headers and no cookies, and only to this app's own URLs.
//
// A request the shell cannot carry goes direct, as before: one that reports
// progress, a body that cannot cross postMessage, a URL outside this app,
// anything the shell refuses, and everything under a shell that predates the
// bridge.

import axios, {
  AxiosError,
  AxiosHeaders,
  CanceledError,
  type AxiosAdapter,
  type AxiosResponse,
  type InternalAxiosRequestConfig,
} from 'axios'
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

const responseTypes = ['json', 'text', 'blob', 'arraybuffer']

/* eslint-disable lingui/no-unlocalized-strings -- axios's own messages, word
   for word, so a caller sees what axios's adapter would have given it, and one
   for the redirect a write met, which that adapter follows instead. */
const messages = {
  network: 'Network Error',
  status: 'Request failed with status code ',
  timeout: (milliseconds: number) =>
    'timeout of ' + milliseconds + 'ms exceeded',
  redirect: 'Redirect not followed',
}
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

function listen() {
  if (listening) return
  listening = true
  onShellMessage((message) => {
    if (message.type !== 'fetch.result') return
    const id = message.id as string
    const settle = waiting.get(id)
    if (!settle) return
    waiting.delete(id)
    settle(message as unknown as Reply)
  })
}

// axios's own adapter, which the request would have used without this one.
function direct(config: InternalAxiosRequestConfig) {
  return axios.getAdapter(axios.defaults.adapter)(config)
}

// The first path segment: the app a URL belongs to, as the shell judges it.
function segment(path: string): string {
  const match = /^\/([^/]+)/.exec(path)
  return match ? match[1] : ''
}

// The request as the shell takes it, or null when it must go direct.
function carried(config: InternalAxiosRequestConfig): Carried | null {
  if (config.onUploadProgress || config.onDownloadProgress || config.auth)
    return null
  if (config.responseType && !responseTypes.includes(config.responseType))
    return null

  const origin = shellOrigin()
  let url: URL
  try {
    url = new URL(axios.getUri(config), window.location.href)
  } catch {
    return null
  }
  const app = segment(new URL(window.location.href).pathname)
  if (!app || url.origin !== origin || segment(url.pathname) !== app)
    return null

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

  const headers = AxiosHeaders.from(config.headers)
  // As axios's own adapter: no type for no body, and none for a form, whose
  // boundary the browser writes.
  if (body === undefined || data instanceof FormData)
    headers.setContentType(null)
  const pairs: Array<[string, string]> = []
  for (const [name, value] of Object.entries(headers.toJSON(true))) {
    pairs.push([name, String(value)])
  }

  return {
    url: url.href,
    method: (config.method ?? 'get').toUpperCase(),
    headers: pairs,
    body,
  }
}

function decode(
  buffer: ArrayBuffer,
  type: string | undefined,
  headers: AxiosHeaders
): unknown {
  if (type === 'arraybuffer') return buffer
  if (type === 'blob') {
    return new Blob([buffer], {
      type: String(headers.get('content-type') ?? ''),
    })
  }
  // JSON is parsed by the client's transformResponse, as from axios's own.
  return new TextDecoder().decode(buffer)
}

export const shellAdapter: AxiosAdapter = (config) => {
  if (!isInShell() || getShellInitData()?.fetch !== true) return direct(config)
  const request = carried(config)
  if (!request) return direct(config)
  listen()

  return new Promise<AxiosResponse>((resolve, reject) => {
    const id = identifier()
    // What axios calls the request: there is no XMLHttpRequest to hand over.
    const record = { shell: true, id }
    let timer: ReturnType<typeof setTimeout> | undefined
    let onCanceled: ((cancel?: unknown) => void) | undefined

    function done() {
      waiting.delete(id)
      if (timer !== undefined) clearTimeout(timer)
      if (onCanceled) {
        config.cancelToken?.unsubscribe(onCanceled)
        config.signal?.removeEventListener?.('abort', onCanceled)
      }
    }

    function abandon() {
      done()
      window.parent.postMessage({ type: 'fetch.abort', id }, shellOrigin())
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
        reject(
          new AxiosError(
            messages.redirect,
            AxiosError.ERR_BAD_RESPONSE,
            config,
            record
          )
        )
        return
      }
      if (reply.failed || typeof reply.status !== 'number') {
        reject(
          new AxiosError(
            messages.network,
            AxiosError.ERR_NETWORK,
            config,
            record
          )
        )
        return
      }
      const headers = AxiosHeaders.from(Object.fromEntries(reply.headers ?? []))
      const response: AxiosResponse = {
        data: decode(
          reply.body ?? new ArrayBuffer(0),
          config.responseType,
          headers
        ),
        status: reply.status,
        statusText: reply.statusText ?? '',
        headers,
        config,
        request: record,
      }
      const validate = config.validateStatus
      if (!response.status || !validate || validate(response.status)) {
        resolve(response)
        return
      }
      reject(
        new AxiosError(
          messages.status + response.status,
          response.status >= 400 && response.status < 500
            ? AxiosError.ERR_BAD_REQUEST
            : AxiosError.ERR_BAD_RESPONSE,
          config,
          record,
          response
        )
      )
    })

    if (config.timeout) {
      timer = setTimeout(() => {
        abandon()
        reject(
          new AxiosError(
            config.timeoutErrorMessage || messages.timeout(config.timeout ?? 0),
            config.transitional?.clarifyTimeoutError
              ? AxiosError.ETIMEDOUT
              : AxiosError.ECONNABORTED,
            config,
            record
          )
        )
      }, config.timeout)
    }

    if (config.cancelToken || config.signal) {
      onCanceled = (cancel?: unknown) => {
        abandon()
        reject(
          !cancel || (cancel as { type?: string }).type
            ? new CanceledError(undefined, config, record)
            : cancel
        )
      }
      config.cancelToken?.subscribe(onCanceled)
      if (config.signal?.aborted) {
        onCanceled()
        return
      }
      config.signal?.addEventListener?.('abort', onCanceled)
    }

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
