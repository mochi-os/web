// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: Apache-2.0

// A request client: defaults merged into every request, a prepare step (base
// URL, token, cookies), then handlers for every response and failure (HTML
// guard, toasts, 401 logout). A failure the success handler raises does not
// reach the failure handler.

import {
  mergeHeaders,
  prepareBody,
  type HttpRequestConfig,
  type HttpResponse,
} from './http'
import { shellAdapter } from './shell-fetch'

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
      ...config,
      method: (config.method ?? defaults.method ?? 'GET').toUpperCase(),
      headers: mergeHeaders(defaults.headers, config.headers),
    }
    if (prepare) merged = prepare(merged)
    const ready = prepareBody(merged)

    let response: HttpResponse
    try {
      response = await shellAdapter(ready)
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
