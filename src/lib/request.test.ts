// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: Apache-2.0

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { i18n } from '@lingui/core'
import { AxiosError } from 'axios'
import apiClient from './api-client'
import { request, requestHelpers, ApiError } from './request'

// request() turns three shapes of failure into one ApiError: a transport or
// HTTP failure from axios, a root-level status envelope, and a status
// envelope nested under data. Each is logged once in development.
describe('request', () => {
  let errorLog: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    errorLog = vi.spyOn(console, 'error').mockImplementation(() => {})
  })
  afterEach(() => {
    vi.restoreAllMocks()
  })

  const answer = (data: unknown) =>
    vi.spyOn(apiClient, 'request').mockResolvedValue({
      data,
      status: 200,
      statusText: 'OK',
      headers: {},
      config: {},
    } as never)

  it('unwraps the data envelope', async () => {
    answer({ data: { items: [1, 2] } })
    await expect(request<{ items: number[] }>({ url: '/x' })).resolves.toEqual({
      items: [1, 2],
    })
    expect(errorLog).not.toHaveBeenCalled()
  })

  it('turns a root-level status envelope into an ApiError carrying the status', async () => {
    answer({ status: 404, error: 'gone' })
    const failure = (await request({ url: '/x' }).catch(
      (e: unknown) => e
    )) as ApiError
    expect(failure).toBeInstanceOf(ApiError)
    expect(failure.status).toBe(404)
    expect(failure.message).toBe('gone')
  })

  it('turns a status envelope under data into an ApiError', async () => {
    answer({ data: { status: 403, error: 'no' } })
    const failure = (await request({ url: '/x' }).catch(
      (e: unknown) => e
    )) as ApiError
    expect(failure).toBeInstanceOf(ApiError)
    expect(failure.status).toBe(403)
  })

  it('leaves an error field without a status alone: it is data', async () => {
    answer({ data: { error: 'not_found' } })
    await expect(request({ url: '/x' })).resolves.toEqual({
      error: 'not_found',
    })
  })

  it('logs an envelope error once, not once per catch block', async () => {
    answer({ status: 500, error: 'boom' })
    await request({ url: '/x' }).catch(() => {})
    expect(errorLog).toHaveBeenCalledTimes(1)
  })

  it('logs a transport failure once too', async () => {
    vi.spyOn(apiClient, 'request').mockRejectedValue(new Error('Network Error'))
    const failure = (await request({ url: '/x' }).catch(
      (e: unknown) => e
    )) as ApiError
    expect(failure).toBeInstanceOf(ApiError)
    expect(errorLog).toHaveBeenCalledTimes(1)
  })
})

// The sign-in page sends its first requests before its catalogue has loaded,
// and Lingui throws when a message is translated with no active locale: a
// failure then is still an ApiError carrying its status, never Lingui's error.
describe('request before a locale is active', () => {
  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.spyOn(i18n, 'locale', 'get').mockReturnValue('')
  })
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('turns an HTTP failure into an ApiError with its status', async () => {
    vi.spyOn(apiClient, 'request').mockRejectedValue(
      new AxiosError('', AxiosError.ERR_BAD_REQUEST, undefined, undefined, {
        data: {},
        status: 400,
        statusText: '',
        headers: {},
        config: {} as never,
      })
    )
    const failure = (await request({ url: '/x' }).catch(
      (e: unknown) => e
    )) as ApiError
    expect(failure).toBeInstanceOf(ApiError)
    expect(failure.status).toBe(400)
  })

  it("turns a raw request's failure into an ApiError with its status too", async () => {
    vi.spyOn(apiClient, 'request').mockRejectedValue(
      new AxiosError('', AxiosError.ERR_BAD_RESPONSE, undefined, undefined, {
        data: {},
        status: 503,
        statusText: '',
        headers: {},
        config: {} as never,
      })
    )
    const failure = (await requestHelpers
      .getRaw('/x')
      .catch((e: unknown) => e)) as ApiError
    expect(failure).toBeInstanceOf(ApiError)
    expect(failure.status).toBe(503)
  })

  it('turns a network failure into an ApiError too', async () => {
    vi.spyOn(apiClient, 'request').mockRejectedValue(
      new AxiosError('Network Error', AxiosError.ERR_NETWORK)
    )
    const failure = (await request({ url: '/x' }).catch(
      (e: unknown) => e
    )) as ApiError
    expect(failure).toBeInstanceOf(ApiError)
  })
})
