// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: Apache-2.0

// The request engine under apiClient and createAppClient. Requests go by
// fetch(), apart from ones that report progress, which go by XMLHttpRequest:
// fetch() reports no upload progress. Inside the shell, shell-fetch.ts sends
// most requests through the shell page and falls back to sendDirect().

export interface TransferProgress {
  loaded: number
  /** Absent when the size is not known. */
  total?: number
}

/** Without one, a body that parses as JSON is parsed, and any other is text. */
export type HttpResponseType = 'blob' | 'arraybuffer'

/** `undefined` and `null` values are left out of the query string. */
export type HttpParams = Record<
  string,
  string | number | boolean | null | undefined
>

/** An `undefined` value removes a header the client would otherwise send. */
export type HttpHeaders = Record<string, string | undefined>

export interface MochiRequestOptions {
  showGlobalErrorToast?: boolean
  toastDedupeKey?: string
  toastDedupeTtlMs?: number
}

export interface HttpRequestConfig<TBody = unknown> {
  url?: string
  method?: string
  baseURL?: string
  data?: TBody
  params?: HttpParams
  headers?: HttpHeaders
  /** Milliseconds; 0 or absent waits for ever. */
  timeout?: number
  signal?: AbortSignal
  responseType?: HttpResponseType
  /** Sends cookies to other origins too. Same-origin requests always send them. */
  withCredentials?: boolean
  /** Lets the browser finish the request after the page has gone. */
  keepalive?: boolean
  onUploadProgress?: (event: TransferProgress) => void
  onDownloadProgress?: (event: TransferProgress) => void
  mochi?: MochiRequestOptions
}

export interface HttpResponse<T = unknown> {
  data: T
  status: number
  statusText: string
  /** Lower-case names. */
  headers: Record<string, string>
  config: HttpRequestConfig
}

/** A response outside 2xx is ERR_BAD_REQUEST for 4xx, ERR_BAD_RESPONSE otherwise. */
export type HttpErrorCode =
  | 'ERR_BAD_REQUEST'
  | 'ERR_BAD_RESPONSE'
  | 'ERR_NETWORK'
  | 'ECONNABORTED'
  | 'ERR_CANCELED'

// Responses and errors keep the config without the session token: errors are
// logged and passed around, and none of their readers needs it.
function withoutAuthorization(config: HttpRequestConfig): HttpRequestConfig {
  if (!config.headers) return config
  const headers: HttpHeaders = {}
  for (const [name, value] of Object.entries(config.headers)) {
    if (name.toLowerCase() !== 'authorization') headers[name] = value
  }
  return { ...config, headers }
}

/**
 * A failed request. `response` is there only when the server answered;
 * `status` and `data` repeat its fields for readers of either shape.
 */
export class HttpError<T = unknown> extends Error {
  readonly code: HttpErrorCode
  readonly config: HttpRequestConfig
  // Declared, not initialised, so `'response' in error` is false without one.
  declare readonly response?: HttpResponse<T>
  declare readonly status?: number
  declare readonly data?: T

  constructor(
    message: string,
    code: HttpErrorCode,
    config: HttpRequestConfig,
    response?: HttpResponse<T>,
    cause?: unknown
  ) {
    super(message, cause === undefined ? undefined : { cause })
    this.name = 'HttpError'
    this.code = code
    this.config = withoutAuthorization(config)
    if (response) {
      Object.assign(this, {
        response,
        status: response.status,
        data: response.data,
      })
    }
  }
}

export function isHttpError(error: unknown): error is HttpError {
  return error instanceof HttpError
}

/* eslint-disable lingui/no-unlocalized-strings -- kept word for word for
   existing readers; normalizeError translates the network one. */
const messages = {
  network: 'Network Error',
  status: (status: number) => `Request failed with status code ${status}`,
  timeout: (milliseconds: number) => `timeout of ${milliseconds}ms exceeded`,
  canceled: 'canceled',
  aborted: 'Request aborted',
}
/* eslint-enable lingui/no-unlocalized-strings */

export const httpErrors = {
  // cause keeps what actually failed: the message stays "Network Error" for
  // its readers, but a bad header, URL or body is not a network fault, and
  // only the cause says which it was.
  network: (config: HttpRequestConfig, cause?: unknown) =>
    new HttpError(messages.network, 'ERR_NETWORK', config, undefined, cause),
  timeout: (config: HttpRequestConfig) =>
    new HttpError(
      messages.timeout(config.timeout ?? 0),
      'ECONNABORTED',
      config
    ),
  canceled: (config: HttpRequestConfig) =>
    new HttpError(messages.canceled, 'ERR_CANCELED', config),
}

// ---------------------------------------------------------------------------
// URLs

/** `scheme://` or `//`: a URL that ignores baseURL. */
function isAbsoluteURL(url: string): boolean {
  return /^([a-z][a-z\d+\-.]*:)?\/\//i.test(url)
}

/**
 * baseURL and url joined. isSameOriginRequest uses this same function, so the
 * token check and the request always agree on the destination.
 */
export function buildFullPath(
  baseURL: string | undefined,
  url: string | undefined
): string {
  const target = url ?? ''
  if (!baseURL || isAbsoluteURL(target)) return target
  if (!target) return baseURL
  return `${baseURL.replace(/\/+$/, '')}/${target.replace(/^\/+/, '')}`
}

// encodeURIComponent with `:`, `$`, `,` left plain and a space as `+`.
function encodeParam(value: string): string {
  return encodeURIComponent(value)
    .replace(/%3A/gi, ':')
    .replace(/%24/g, '$')
    .replace(/%2C/gi, ',')
    .replace(/%20/g, '+')
}

/** The URL a request goes to: full path plus its query string. */
export function buildURL(config: HttpRequestConfig): string {
  let url = buildFullPath(config.baseURL, config.url)
  const query = Object.entries(config.params ?? {})
    .filter(([, value]) => value !== undefined && value !== null)
    .map(([key, value]) => `${encodeParam(key)}=${encodeParam(String(value))}`)
    .join('&')
  if (!query) return url
  const hash = url.indexOf('#')
  if (hash !== -1) url = url.slice(0, hash)
  return url + (url.includes('?') ? '&' : '?') + query
}

// ---------------------------------------------------------------------------
// Headers and body

/** Merged left to right, names compared without case; `undefined` removes one. */
export function mergeHeaders(
  ...sets: Array<HttpHeaders | undefined>
): HttpHeaders {
  const merged: HttpHeaders = {}
  for (const set of sets) {
    for (const [name, value] of Object.entries(set ?? {})) {
      for (const existing of Object.keys(merged)) {
        if (existing.toLowerCase() === name.toLowerCase())
          delete merged[existing]
      }
      merged[name] = value
    }
  }
  return merged
}

function contentType(headers: HttpHeaders): string {
  for (const [name, value] of Object.entries(headers)) {
    if (name.toLowerCase() === 'content-type') return value ?? ''
  }
  return ''
}

function withoutContentType(headers: HttpHeaders): HttpHeaders {
  return mergeHeaders(headers, { 'Content-Type': undefined })
}

/**
 * The body encoded and the headers final. FormData never gets a Content-Type,
 * so the browser writes the multipart boundary. Objects become JSON; a string
 * under a JSON type is sent as it is if it parses, else as a JSON string.
 */
export function prepareBody(config: HttpRequestConfig): HttpRequestConfig {
  const data: unknown = config.data
  const headers = mergeHeaders(config.headers)

  if (data === undefined || data === null) {
    return { ...config, data: undefined, headers: withoutContentType(headers) }
  }
  if (data instanceof FormData) {
    return { ...config, headers: withoutContentType(headers) }
  }
  if (
    data instanceof Blob ||
    data instanceof ArrayBuffer ||
    ArrayBuffer.isView(data)
  ) {
    return { ...config, headers }
  }
  if (data instanceof URLSearchParams) {
    return { ...config, data: data.toString(), headers }
  }
  const json = contentType(headers).includes('application/json')
  if (typeof data === 'string') {
    if (!json) return { ...config, headers }
    try {
      JSON.parse(data)
      return { ...config, data: data.trim(), headers }
    } catch {
      return { ...config, data: JSON.stringify(data), headers }
    }
  }
  if (typeof data === 'object') {
    return {
      ...config,
      data: JSON.stringify(data),
      headers: contentType(headers)
        ? headers
        : mergeHeaders(headers, { 'Content-Type': 'application/json' }),
    }
  }
  // A number or boolean: as JSON under a JSON type, else as text.
  return {
    ...config,
    data: json ? JSON.stringify(data) : String(data),
    headers,
  }
}

/** Header pairs to send, the removed ones left out. */
export function headerPairs(headers: HttpHeaders | undefined) {
  return Object.entries(headers ?? {}).filter(
    (pair): pair is [string, string] => pair[1] !== undefined
  )
}

// ---------------------------------------------------------------------------
// Responses

/**
 * A 2xx resolves, anything else rejects with the response attached. With no
 * response type, JSON is parsed and anything else stays text.
 */
export function settle(
  config: HttpRequestConfig,
  status: number,
  statusText: string,
  headers: Record<string, string>,
  body: string | Blob | ArrayBuffer
): HttpResponse {
  let data: unknown = body
  if (!config.responseType && typeof body === 'string' && body) {
    try {
      data = JSON.parse(body)
    } catch {
      // Not JSON: the text as it is.
    }
  }
  const kept = withoutAuthorization(config)
  const response: HttpResponse = {
    data,
    status,
    statusText,
    headers,
    config: kept,
  }
  if (status >= 200 && status < 300) return response
  throw new HttpError(
    messages.status(status),
    status >= 400 && status < 500 ? 'ERR_BAD_REQUEST' : 'ERR_BAD_RESPONSE',
    kept,
    response
  )
}

/** Header pairs as a record with lower-case names. */
export function headerRecord(
  pairs: Iterable<[string, string]>
): Record<string, string> {
  const record: Record<string, string> = {}
  for (const [name, value] of pairs) record[name.toLowerCase()] = value
  return record
}

// ---------------------------------------------------------------------------
// Transports

export interface SendOptions {
  /**
   * No cookies to any origin unless withCredentials is set: for the shell's
   * frame, whose token is its only credential. fetch() only; XMLHttpRequest
   * cannot express it.
   */
  omitCredentials?: boolean
}

/** Sends a prepared request (see prepareBody) straight to the server. */
export function sendDirect(
  config: HttpRequestConfig,
  options: SendOptions = {}
): Promise<HttpResponse> {
  if (config.onUploadProgress || config.onDownloadProgress) {
    return sendXhr(config)
  }
  return sendFetch(config, options)
}

function credentials(
  config: HttpRequestConfig,
  options: SendOptions
): RequestCredentials {
  if (config.withCredentials) return 'include'
  return options.omitCredentials ? 'omit' : 'same-origin'
}

async function sendFetch(
  config: HttpRequestConfig,
  options: SendOptions
): Promise<HttpResponse> {
  if (config.signal?.aborted) throw httpErrors.canceled(config)

  const controller = new AbortController()
  let ended: 'timeout' | 'canceled' | undefined
  const timer = config.timeout
    ? setTimeout(() => {
        ended = 'timeout'
        controller.abort()
      }, config.timeout)
    : undefined
  const cancel = () => {
    ended = 'canceled'
    controller.abort()
  }
  config.signal?.addEventListener('abort', cancel)

  try {
    const response = await fetch(buildURL(config), {
      method: (config.method ?? 'GET').toUpperCase(),
      headers: headerPairs(config.headers),
      body: config.data as BodyInit | undefined,
      credentials: credentials(config, options),
      keepalive: config.keepalive,
      signal: controller.signal,
    })
    const body =
      config.responseType === 'blob'
        ? await response.blob()
        : config.responseType === 'arraybuffer'
          ? await response.arrayBuffer()
          : await response.text()
    return settle(
      config,
      response.status,
      response.statusText,
      headerRecord(response.headers),
      body
    )
  } catch (error) {
    if (error instanceof HttpError) throw error
    if (ended === 'timeout') throw httpErrors.timeout(config)
    if (ended === 'canceled') throw httpErrors.canceled(config)
    throw httpErrors.network(config, error)
  } finally {
    clearTimeout(timer)
    config.signal?.removeEventListener('abort', cancel)
  }
}

// At most three reports a second, the latest kept for the next slot, and the
// last always delivered when the request ends.
function progressReporter(listener: (event: TransferProgress) => void) {
  const interval = 1000 / 3
  let last = 0
  let pending: TransferProgress | null = null
  let timer: ReturnType<typeof setTimeout> | undefined

  const deliver = (event: TransferProgress) => {
    last = Date.now()
    pending = null
    clearTimeout(timer)
    timer = undefined
    listener(event)
  }

  const report = (event: ProgressEvent) => {
    const total = event.lengthComputable ? event.total : undefined
    const loaded = Math.max(
      0,
      total !== undefined ? Math.min(event.loaded, total) : event.loaded
    )
    const progress: TransferProgress = { loaded, total }
    const waited = Date.now() - last
    if (waited >= interval) {
      deliver(progress)
      return
    }
    pending = progress
    timer ??= setTimeout(() => pending && deliver(pending), interval - waited)
  }

  const flush = () => {
    if (pending) deliver(pending)
  }

  return { report, flush }
}

function sendXhr(config: HttpRequestConfig): Promise<HttpResponse> {
  return new Promise((resolve, reject) => {
    if (config.signal?.aborted) {
      reject(httpErrors.canceled(config))
      return
    }

    const xhr = new XMLHttpRequest()
    xhr.open((config.method ?? 'GET').toUpperCase(), buildURL(config), true)
    xhr.timeout = config.timeout ?? 0
    xhr.withCredentials = Boolean(config.withCredentials)
    if (config.responseType) xhr.responseType = config.responseType
    for (const [name, value] of headerPairs(config.headers)) {
      xhr.setRequestHeader(name, value)
    }

    const download = config.onDownloadProgress
      ? progressReporter(config.onDownloadProgress)
      : undefined
    const upload = config.onUploadProgress
      ? progressReporter(config.onUploadProgress)
      : undefined
    if (download) xhr.addEventListener('progress', download.report)
    if (upload) xhr.upload?.addEventListener('progress', upload.report)

    let finished = false
    const cancel = () => {
      finish(() => reject(httpErrors.canceled(config)))
      xhr.abort()
    }
    function finish(outcome: () => void) {
      if (finished) return
      finished = true
      upload?.flush()
      download?.flush()
      config.signal?.removeEventListener('abort', cancel)
      outcome()
    }

    xhr.onload = () =>
      finish(() => {
        try {
          resolve(
            settle(
              config,
              xhr.status,
              xhr.statusText,
              headerRecord(parseHeaders(xhr.getAllResponseHeaders())),
              config.responseType ? xhr.response : xhr.responseText
            )
          )
        } catch (error) {
          reject(error)
        }
      })
    xhr.onerror = () => finish(() => reject(httpErrors.network(config)))
    xhr.ontimeout = () => finish(() => reject(httpErrors.timeout(config)))
    xhr.onabort = () =>
      finish(() =>
        reject(new HttpError(messages.aborted, 'ECONNABORTED', config))
      )
    config.signal?.addEventListener('abort', cancel)

    xhr.send((config.data as XMLHttpRequestBodyInit | undefined) ?? null)
  })
}

function parseHeaders(raw: string): Array<[string, string]> {
  const pairs: Array<[string, string]> = []
  for (const line of raw.split(/\r?\n/)) {
    const colon = line.indexOf(':')
    if (colon > 0) {
      pairs.push([line.slice(0, colon).trim(), line.slice(colon + 1).trim()])
    }
  }
  return pairs
}
