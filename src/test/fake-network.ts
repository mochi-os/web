// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: Apache-2.0

// Stand-ins for the two ways the request client reaches the server, fetch()
// and XMLHttpRequest, so a test drives the real client end to end and reads
// what went out. Each records the requests it was given and answers with what
// the test set.

import { vi } from 'vitest'

export interface SentRequest {
  url: string
  method: string
  headers: Record<string, string>
  body: unknown
  credentials?: RequestCredentials
  keepalive?: boolean
  withCredentials?: boolean
  by: 'fetch' | 'xhr'
}

export interface Answer {
  status?: number
  statusText?: string
  headers?: Record<string, string>
  /** A string is sent as it is; anything else as JSON. */
  body?: unknown
}

type Answerer = (request: SentRequest) => Answer | Promise<Answer>

function lowerCase(headers: Iterable<[string, string]>) {
  const record: Record<string, string> = {}
  for (const [name, value] of headers) record[name.toLowerCase()] = value
  return record
}

function text(body: unknown): string {
  if (body === undefined) return ''
  return typeof body === 'string' ? body : JSON.stringify(body)
}

/**
 * Replaces fetch and XMLHttpRequest for the test. Undo with
 * vi.unstubAllGlobals(). By default every request is answered 200 with `{}`.
 */
export function fakeNetwork(answer: Answerer = () => ({ body: {} })) {
  const sent: SentRequest[] = []
  let answerer = answer

  const fetch = vi.fn(async (url: string, init: RequestInit = {}) => {
    const request: SentRequest = {
      url,
      method: init.method ?? 'GET',
      headers: lowerCase(new Headers(init.headers).entries()),
      body: init.body,
      credentials: init.credentials,
      keepalive: init.keepalive,
      by: 'fetch',
    }
    sent.push(request)
    if (init.signal?.aborted) throw new DOMException('Aborted', 'AbortError')
    const reply = await new Promise<Answer>((resolve, reject) => {
      init.signal?.addEventListener('abort', () =>
        reject(new DOMException('Aborted', 'AbortError'))
      )
      Promise.resolve(answerer(request)).then(resolve, reject)
    })
    const status = reply.status ?? 200
    return new Response(
      [204, 205, 304].includes(status) ? null : text(reply.body),
      {
        status,
        statusText: reply.statusText ?? '',
        headers: reply.headers ?? {},
      }
    )
  })

  class FakeXhr {
    static instances: FakeXhr[] = []
    readonly upload = new EventTarget()
    private readonly listeners = new EventTarget()
    private request?: SentRequest
    private requestHeaders: Record<string, string> = {}
    private answered?: Answer
    timeout = 0
    withCredentials = false
    responseType: XMLHttpRequestResponseType = ''
    status = 0
    statusText = ''
    responseText = ''
    response: unknown = null
    onload: (() => void) | null = null
    onerror: (() => void) | null = null
    ontimeout: (() => void) | null = null
    onabort: (() => void) | null = null
    private method = 'GET'
    private url = ''
    // The browser's own timer for xhr.timeout, which ends the request with
    // ontimeout. Under fake timers a test drives it with the clock.
    private timer?: ReturnType<typeof setTimeout>

    constructor() {
      FakeXhr.instances.push(this)
    }

    open(method: string, url: string) {
      this.method = method
      this.url = url
    }

    setRequestHeader(name: string, value: string) {
      this.requestHeaders[name.toLowerCase()] = value
    }

    addEventListener(type: string, listener: EventListener) {
      this.listeners.addEventListener(type, listener)
    }

    getAllResponseHeaders() {
      return Object.entries(this.answered?.headers ?? {})
        .map(([name, value]) => `${name}: ${value}\r\n`)
        .join('')
    }

    send(body: unknown) {
      this.request = {
        url: this.url,
        method: this.method,
        headers: this.requestHeaders,
        body: body ?? undefined,
        withCredentials: this.withCredentials,
        by: 'xhr',
      }
      sent.push(this.request)
      const request = this.request
      if (this.timeout > 0) {
        this.timer = setTimeout(() => {
          this.status = -1
          this.ontimeout?.()
        }, this.timeout)
      }
      void Promise.resolve(answerer(request)).then((reply) => {
        if (this.status === -1) return
        clearTimeout(this.timer)
        this.answered = reply
        this.status = reply.status ?? 200
        this.statusText = reply.statusText ?? ''
        this.responseText = text(reply.body)
        this.response =
          this.responseType === 'blob'
            ? new Blob([this.responseText])
            : this.responseText
        this.onload?.()
      })
    }

    abort() {
      clearTimeout(this.timer)
      this.status = -1
      this.onabort?.()
    }

    /** Reports progress as the browser would. */
    progress(direction: 'upload' | 'download', loaded: number, total?: number) {
      const event = new ProgressEvent('progress', {
        loaded,
        total: total ?? 0,
        lengthComputable: total !== undefined,
      })
      if (direction === 'upload') this.upload.dispatchEvent(event)
      else this.listeners.dispatchEvent(event)
    }

    /** Fails as the browser does when the connection drops. */
    fail() {
      clearTimeout(this.timer)
      this.status = -1
      this.onerror?.()
    }
  }

  vi.stubGlobal('fetch', fetch)
  // eslint-disable-next-line lingui/no-unlocalized-strings -- a global's name, not text
  vi.stubGlobal('XMLHttpRequest', FakeXhr)

  return {
    sent,
    fetch,
    xhrs: FakeXhr.instances,
    answer: (next: Answerer) => {
      answerer = next
    },
  }
}
