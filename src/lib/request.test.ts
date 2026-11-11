// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: Apache-2.0

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { fakeNetwork } from '../test/fake-network'
import { useAuthStore } from '../stores/auth-store'
import type { HttpError } from './http'
import apiClient from './api-client'
import { request, ApiError } from './request'

// request() turns three shapes of failure into one ApiError: a transport or
// HTTP failure from the client, a root-level status envelope, and a status
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

// An ApiError keeps the failed request as its cause, and that cause is logged:
// it carries everything but the session token.
describe('the cause of an ApiError', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
    useAuthStore.setState({ token: '' })
  })

  for (const [by, extra] of Object.entries({
    fetch: {},
    xhr: { onUploadProgress: () => {} },
  })) {
    it(`has no Authorization header (${by})`, async () => {
      vi.spyOn(console, 'error').mockImplementation(() => {})
      vi.spyOn(console, 'log').mockImplementation(() => {})
      const { sent } = fakeNetwork(() => ({ status: 403, body: { e: 1 } }))
      useAuthStore.setState({ token: 'secret' })

      const failure = (await request({
        method: 'POST',
        url: '/_/x',
        data: 'body',
        ...extra,
      }).catch((e: unknown) => e)) as ApiError

      expect(sent[0]).toMatchObject({ by })
      expect(sent[0].headers.authorization).toBe('Bearer secret')
      expect(failure).toBeInstanceOf(ApiError)
      expect(failure.status).toBe(403)
      expect(failure.data).toEqual({ e: 1 })
      const cause = failure.cause as HttpError
      for (const config of [cause.config, cause.response?.config]) {
        expect(config?.headers).toEqual({
          Accept: 'application/json',
          'Content-Type': 'application/json',
        })
      }
    })
  }
})
