// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: Apache-2.0

// A request client: defaults merged into every request, a prepare step (base
// URL, token, cookies), then handlers for every response and failure (HTML
// guard, toasts, 401 logout). Everything that fails on the way out, prepare
// and body encoding included, reaches the failure handler; a failure the
// success handler raises does not.

import {
  buildFullPath,
  mergeHeaders,
  prepareBody,
  rewritesPath,
  type HttpRequestConfig,
  type HttpResponse,
} from './http'
import { Refusal } from './request-path'
import { shellAdapter } from './shell-fetch'

/**
 * Throws, before anything is sent, when the browser would send the request to
 * a path other than the one its baseURL and url join to: an id holding `../`
 * or `..\` would otherwise move it to another action of the same app. Every
 * client's requests pass here.
 */
function checkPath(config: HttpRequestConfig) {
  const url = buildFullPath(config.baseURL, config.url)
  if (rewritesPath(url)) {
    // The path only: a query can carry a token.
    const path = url.split(/[?#]/)[0]
    throw new Refusal(
      // eslint-disable-next-line lingui/no-unlocalized-strings -- for developers; normalizeError shows the caller's words
      `Request not sent: ${path} resolves to another path`
    )
  }
}

export interface ResponseHandlers {
  success: <T>(response: HttpResponse<T>) => HttpResponse<T>
  failure: (error: unknown) => Promise<never>
}

interface HttpClientOptions {
  defaults?: Omit<HttpRequestConfig, 'url' | 'data'>
  prepare?: (config: HttpRequestConfig) => HttpRequestConfig
  handlers?: ResponseHandlers
}

/** Per-request options of a method call, beside its URL and body. */
export type HttpMethodConfig<TBody = unknown> = Omit<
  HttpRequestConfig<TBody>,
  'url' | 'method' | 'data'
>

export interface HttpClient {
  request: <T = unknown>(config: HttpRequestConfig) => Promise<HttpResponse<T>>
  get: <T = unknown>(
    url: string,
    config?: Omit<HttpRequestConfig, 'url' | 'method'>
  ) => Promise<HttpResponse<T>>
  delete: <T = unknown>(
    url: string,
    config?: Omit<HttpRequestConfig, 'url' | 'method'>
  ) => Promise<HttpResponse<T>>
  post: <T = unknown, TBody = unknown>(
    url: string,
    data?: TBody,
    config?: HttpMethodConfig<TBody>
  ) => Promise<HttpResponse<T>>
  put: <T = unknown, TBody = unknown>(
    url: string,
    data?: TBody,
    config?: HttpMethodConfig<TBody>
  ) => Promise<HttpResponse<T>>
  patch: <T = unknown, TBody = unknown>(
    url: string,
    data?: TBody,
    config?: HttpMethodConfig<TBody>
  ) => Promise<HttpResponse<T>>
}

// A key passed as undefined leaves the default in place, as Axios did. A
// wrapper that forwards `timeout: options.timeout` must not wipe out the
// client's own timeout when the caller sets none.
function withoutUndefined<T extends object>(config: T): T {
  return Object.fromEntries(
    Object.entries(config).filter(([, value]) => value !== undefined)
  ) as T
}

export function createHttpClient({
  defaults = {},
  prepare,
  handlers,
}: HttpClientOptions = {}): HttpClient {
  async function request<T>(
    config: HttpRequestConfig
  ): Promise<HttpResponse<T>> {
    let merged: HttpRequestConfig = {
      ...defaults,
      ...withoutUndefined(config),
      method: (config.method ?? defaults.method ?? 'GET').toUpperCase(),
      headers: mergeHeaders(defaults.headers, config.headers),
    }
    let response: HttpResponse
    try {
      if (prepare) merged = prepare(merged)
      checkPath(merged)
      response = await shellAdapter(prepareBody(merged))
    } catch (error) {
      if (handlers) return handlers.failure(error)
      throw error
    }
    const typed = response as HttpResponse<T>
    return handlers ? handlers.success(typed) : typed
  }

  const withoutBody =
    (method: string) =>
    <T>(url: string, config?: Omit<HttpRequestConfig, 'url' | 'method'>) =>
      request<T>({ ...config, method, url })

  const withBody =
    (method: string) =>
    <T, TBody>(url: string, data?: TBody, config?: HttpMethodConfig<TBody>) =>
      request<T>({ ...config, method, url, data })

  return {
    request,
    get: withoutBody('GET'),
    delete: withoutBody('DELETE'),
    post: withBody('POST'),
    put: withBody('PUT'),
    patch: withBody('PATCH'),
  }
}
