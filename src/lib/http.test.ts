// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: Apache-2.0

// What the apps rely on from the request engine: where a request goes, its
// body and headers, what comes back, and how each failure looks. Driven
// through a real client with the browser's transports faked (fake-network.ts).

import { afterEach, describe, expect, it, vi } from 'vitest'
import { fakeNetwork } from '../test/fake-network'
import { buildFullPath, buildURL, HttpError } from './http'
import { createHttpClient } from './http-client'

afterEach(() => {
  vi.unstubAllGlobals()
  vi.useRealTimers()
})

const json = { 'Content-Type': 'application/json' }

describe('the URL', () => {
  it('joins baseURL and url with one slash', () => {
    expect(buildFullPath('/feeds/', '/-/list')).toBe('/feeds/-/list')
    expect(buildFullPath('/feeds', '-/list')).toBe('/feeds/-/list')
    expect(buildFullPath('/feeds//', '/-/list')).toBe('/feeds/-/list')
    expect(buildFullPath('/feeds/', '')).toBe('/feeds/')
    expect(buildFullPath(undefined, 'x')).toBe('x')
  })

  it('ignores baseURL for // and scheme:// URLs', () => {
    expect(buildFullPath('/feeds/', '//elsewhere.example/x')).toBe(
      '//elsewhere.example/x'
    )
    expect(buildFullPath('/feeds/', 'https://elsewhere.example/x')).toBe(
      'https://elsewhere.example/x'
    )
    // Without "//" a scheme-like string is a relative path.
    expect(buildFullPath('/feeds/', 'javascript:alert(1)')).toBe(
      '/feeds/javascript:alert(1)'
    )
  })

  it('encodes params and leaves out undefined and null', () => {
    expect(
      buildURL({
        url: '/x',
        params: {
          q: 'a b,c:d$e&f',
          page: 2,
          on: true,
          gone: undefined,
          none: null,
        },
      })
    ).toBe('/x?q=a+b,c:d$e%26f&page=2&on=true')
  })

  it('adds params after an existing query and drops a hash', () => {
    expect(buildURL({ url: '/x?a=1#top', params: { b: 2 } })).toBe('/x?a=1&b=2')
    expect(buildURL({ url: '/x#top', params: {} })).toBe('/x#top')
  })
})

describe('the request', () => {
  it('sends an object as JSON', async () => {
    const { sent } = fakeNetwork()
    await createHttpClient({ defaults: { headers: json } }).post('/x', {
      a: 1,
    })
    expect(sent[0].body).toBe('{"a":1}')
    expect(sent[0].headers['content-type']).toBe('application/json')
  })

  it('sends a string under a JSON type as JSON unless it already is', async () => {
    const { sent } = fakeNetwork()
    const client = createHttpClient({ defaults: { headers: json } })
    await client.post('/x', ' {"a":1} ')
    await client.post('/x', 'plain')
    expect(sent[0].body).toBe('{"a":1}')
    expect(sent[1].body).toBe('"plain"')
  })

  it('sends a form string under its own type as it is', async () => {
    const { sent } = fakeNetwork()
    await createHttpClient({ defaults: { headers: json } }).post(
      '/x',
      'a=1&b=2',
      { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
    )
    expect(sent[0].body).toBe('a=1&b=2')
    expect(sent[0].headers['content-type']).toBe(
      'application/x-www-form-urlencoded'
    )
  })

  it('sends URLSearchParams as their text', async () => {
    const { sent } = fakeNetwork()
    await createHttpClient().post('/x', new URLSearchParams({ q: 'a b' }))
    expect(sent[0].body).toBe('q=a+b')
  })

  it('never sets a type on a form, even one set by hand, so the browser writes the boundary', async () => {
    const { sent } = fakeNetwork()
    const form = new FormData()
    form.append('file', new File(['x'], 'x.txt'))
    await createHttpClient({ defaults: { headers: json } }).post('/x', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
    expect(sent[0].body).toBe(form)
    expect(sent[0].headers['content-type']).toBeUndefined()
  })

  it('sends no type without a body', async () => {
    const { sent } = fakeNetwork()
    await createHttpClient({ defaults: { headers: json } }).get('/x')
    expect(sent[0].body).toBeUndefined()
    expect(sent[0].headers['content-type']).toBeUndefined()
  })

  it('lets a request override or remove a default header, whatever its case', async () => {
    const { sent } = fakeNetwork()
    const client = createHttpClient({
      defaults: { headers: { ...json, Accept: 'application/json' } },
    })
    await client.post('/x', 'a', { headers: { 'content-type': 'text/plain' } })
    await client.post('/x', 'a', { headers: { 'Content-Type': undefined } })
    expect(sent[0].headers['content-type']).toBe('text/plain')
    expect(sent[1].headers['content-type']).toBeUndefined()
    expect(sent[1].headers.accept).toBe('application/json')
  })

  it('sends cookies elsewhere only with withCredentials, and keepalive when asked', async () => {
    const { sent } = fakeNetwork()
    const client = createHttpClient()
    await client.get('/x')
    await client.post('/x', {}, { withCredentials: true, keepalive: true })
    expect(sent[0].credentials).toBe('same-origin')
    expect(sent[0].keepalive).toBeUndefined()
    expect(sent[1].credentials).toBe('include')
    expect(sent[1].keepalive).toBe(true)
  })
})

describe('the response', () => {
  it('parses a JSON body and leaves any other as text', async () => {
    fakeNetwork((request) =>
      request.url === '/json'
        ? { body: { a: 1 } }
        : request.url === '/page'
          ? { body: '<!doctype html><html></html>' }
          : { status: 204 }
    )
    const client = createHttpClient()
    expect((await client.get('/json')).data).toEqual({ a: 1 })
    expect((await client.get('/page')).data).toBe(
      '<!doctype html><html></html>'
    )
    expect((await client.get('/empty')).data).toBe('')
  })

  it('returns a blob when asked, with lower-case header names', async () => {
    fakeNetwork(() => ({
      body: 'bytes',
      headers: { 'Content-Disposition': 'attachment; filename="a.txt"' },
    }))
    const response = await createHttpClient().get('/x', {
      responseType: 'blob',
    })
    expect(await (response.data as Blob).text()).toBe('bytes')
    expect(response.headers['content-disposition']).toBe(
      'attachment; filename="a.txt"'
    )
  })
})

describe('a failure', () => {
  it('outside 2xx carries the response, with status and data repeated', async () => {
    fakeNetwork(() => ({
      status: 404,
      statusText: 'Not Found',
      body: { error: 'gone' },
    }))
    const error = (await createHttpClient()
      .get('/x')
      .catch((e: unknown) => e)) as HttpError
    expect(error).toBeInstanceOf(HttpError)
    expect(error.message).toBe('Request failed with status code 404')
    expect(error.code).toBe('ERR_BAD_REQUEST')
    expect(error.status).toBe(404)
    expect(error.data).toEqual({ error: 'gone' })
    expect(error.response?.status).toBe(404)
    expect(error.response?.statusText).toBe('Not Found')
    expect(error.response?.data).toEqual({ error: 'gone' })
    expect(error.config.url).toBe('/x')
  })

  it('of the server is ERR_BAD_RESPONSE', async () => {
    fakeNetwork(() => ({ status: 503, body: {} }))
    const error = (await createHttpClient()
      .get('/x')
      .catch((e: unknown) => e)) as HttpError
    expect(error.code).toBe('ERR_BAD_RESPONSE')
  })

  it('of the connection is a Network Error with no response at all', async () => {
    fakeNetwork(() => Promise.reject(new TypeError('Load failed')))
    const error = (await createHttpClient()
      .get('/x')
      .catch((e: unknown) => e)) as HttpError
    // Safari's wording never reaches the caller: normalizeError translates
    // only "Network Error".
    expect(error.message).toBe('Network Error')
    expect(error.code).toBe('ERR_NETWORK')
    expect('response' in error).toBe(false)
    expect(error.status).toBeUndefined()
  })

  it('of the connection keeps what the browser threw as its cause', async () => {
    const thrown = new TypeError('Failed to fetch')
    fakeNetwork(() => Promise.reject(thrown))
    const error = (await createHttpClient()
      .get('/x')
      .catch((e: unknown) => e)) as HttpError
    expect(error.code).toBe('ERR_NETWORK')
    expect(error.cause).toBe(thrown)
  })

  it('of the request itself is thrown as it is, never as the network', async () => {
    const { sent } = fakeNetwork()
    const client = createHttpClient()
    const header = await client
      .get('/x', { headers: { 'X-Name': 'Zoë ✓' } })
      .catch((e: unknown) => e)
    expect(header).toBeInstanceOf(TypeError)
    const param = await client
      .get('/x', { params: { q: '\ud800' } })
      .catch((e: unknown) => e)
    expect(param).toBeInstanceOf(URIError)
    const circular: Record<string, unknown> = {}
    circular.self = circular
    const body = await client.post('/x', circular).catch((e: unknown) => e)
    expect(body).toBeInstanceOf(TypeError)
    expect(sent).toHaveLength(0)
  })

  it('of time is ECONNABORTED with its fixed wording', async () => {
    vi.useFakeTimers()
    fakeNetwork(() => new Promise(() => {}))
    const result = createHttpClient()
      .get('/x', { timeout: 30000 })
      .catch((e: unknown) => e)
    await vi.advanceTimersByTimeAsync(30000)
    const error = (await result) as HttpError
    expect(error.code).toBe('ECONNABORTED')
    expect(error.message).toBe('timeout of 30000ms exceeded')
  })

  it('of time is ECONNABORTED by XMLHttpRequest too', async () => {
    vi.useFakeTimers()
    fakeNetwork(() => new Promise(() => {}))
    let settled = false
    const result = createHttpClient()
      .post('/x', 'a', { timeout: 30000, onUploadProgress: () => {} })
      .catch((e: unknown) => e)
      .finally(() => (settled = true))
    await vi.advanceTimersByTimeAsync(29999)
    expect(settled).toBe(false)
    await vi.advanceTimersByTimeAsync(1)
    const error = (await result) as HttpError
    expect(error.code).toBe('ECONNABORTED')
    expect(error.message).toBe('timeout of 30000ms exceeded')
  })

  it('waits for ever with no timeout', async () => {
    vi.useFakeTimers()
    let answer: (value: { body: unknown }) => void = () => {}
    fakeNetwork(() => new Promise((resolve) => (answer = resolve)))
    const result = createHttpClient().get('/x', { timeout: 0 })
    await vi.advanceTimersByTimeAsync(600000)
    answer({ body: { late: true } })
    expect((await result).data).toEqual({ late: true })
  })

  it('by the caller is ERR_CANCELED, before or after it was sent', async () => {
    fakeNetwork(() => new Promise(() => {}))
    const client = createHttpClient()
    const controller = new AbortController()
    const result = client
      .get('/x', { signal: controller.signal })
      .catch((e: unknown) => e)
    controller.abort()
    expect(((await result) as HttpError).code).toBe('ERR_CANCELED')

    const early = (await client
      .get('/x', { signal: controller.signal })
      .catch((e: unknown) => e)) as HttpError
    expect(early.code).toBe('ERR_CANCELED')
  })
})

describe('a request that reports progress', () => {
  it('goes by XMLHttpRequest, with its URL, headers and credentials', async () => {
    const { sent } = fakeNetwork()
    await createHttpClient({ defaults: { headers: json } }).post(
      '/x',
      { a: 1 },
      {
        params: { b: 2 },
        withCredentials: true,
        onUploadProgress: () => {},
      }
    )
    expect(sent[0]).toMatchObject({
      by: 'xhr',
      method: 'POST',
      url: '/x?b=2',
      body: '{"a":1}',
      withCredentials: true,
    })
    expect(sent[0].headers['content-type']).toBe('application/json')
  })

  it('reports at most three times a second, and always the last', async () => {
    vi.useFakeTimers()
    let answer: (value: { body: unknown }) => void = () => {}
    const network = fakeNetwork(
      () => new Promise((resolve) => (answer = resolve))
    )
    const heard: Array<{ loaded: number; total?: number }> = []
    const result = createHttpClient().post('/x', 'body', {
      onUploadProgress: (event) => heard.push(event),
    })
    const xhr = network.xhrs[network.xhrs.length - 1]
    xhr.progress('upload', 10, 100)
    xhr.progress('upload', 20, 100)
    xhr.progress('upload', 30, 100)
    expect(heard).toEqual([{ loaded: 10, total: 100 }])
    await vi.advanceTimersByTimeAsync(334)
    expect(heard).toEqual([
      { loaded: 10, total: 100 },
      { loaded: 30, total: 100 },
    ])
    // The count never passes the total, and an unknown total stays unknown.
    await vi.advanceTimersByTimeAsync(334)
    xhr.progress('upload', 120, 100)
    // The last report lands inside the wait: held, then delivered when the
    // request ends, without waiting out its slot.
    xhr.progress('upload', 5)
    expect(heard).toHaveLength(3)
    answer({ body: {} })
    await result
    expect(heard.slice(2)).toEqual([
      { loaded: 100, total: 100 },
      { loaded: 5, total: undefined },
    ])
    expect(vi.getTimerCount()).toBe(0)
  })

  it('reports download bytes too', async () => {
    let answer: (value: { body: unknown }) => void = () => {}
    const network = fakeNetwork(
      () => new Promise((resolve) => (answer = resolve))
    )
    const heard: number[] = []
    const result = createHttpClient().get('/x', {
      responseType: 'blob',
      onDownloadProgress: (event) => heard.push(event.loaded),
    })
    network.xhrs[network.xhrs.length - 1].progress('download', 7, 9)
    answer({ body: 'bytes' })
    expect((await result).data).toBeInstanceOf(Blob)
    expect(heard).toEqual([7])
  })

  it('fails as any other request does', async () => {
    const network = fakeNetwork(() => new Promise(() => {}))
    const client = createHttpClient()

    const dropped = client
      .post('/x', 'a', { onUploadProgress: () => {} })
      .catch((e: unknown) => e)
    network.xhrs[network.xhrs.length - 1].fail()
    expect(((await dropped) as HttpError).code).toBe('ERR_NETWORK')

    const controller = new AbortController()
    const canceled = client
      .post('/x', 'a', {
        onUploadProgress: () => {},
        signal: controller.signal,
      })
      .catch((e: unknown) => e)
    controller.abort()
    expect(((await canceled) as HttpError).code).toBe('ERR_CANCELED')

    network.answer(() => ({ status: 413, body: { error: 'too_large' } }))
    const refused = (await client
      .post('/x', 'a', { onUploadProgress: () => {} })
      .catch((e: unknown) => e)) as HttpError
    expect(refused.code).toBe('ERR_BAD_REQUEST')
    expect(refused.response?.data).toEqual({ error: 'too_large' })
  })
})

// However a request ends, its timeout timer and its listener on the caller's
// signal go with it. One left behind holds memory for every request ever sent
// on a long-lived signal.
describe('a request that has ended', () => {
  const transports = {
    fetch: {},
    xhr: { onUploadProgress: () => {} },
  }
  const endings = ['answered', 'refused', 'canceled', 'timed out'] as const

  for (const [by, extra] of Object.entries(transports)) {
    for (const ending of endings) {
      it(`leaves no timer or listener behind when ${ending} (${by})`, async () => {
        vi.useFakeTimers()
        fakeNetwork(() =>
          ending === 'answered'
            ? { body: {} }
            : ending === 'refused'
              ? { status: 500, body: {} }
              : new Promise(() => {})
        )
        const controller = new AbortController()
        const added = vi.spyOn(controller.signal, 'addEventListener')
        const removed = vi.spyOn(controller.signal, 'removeEventListener')
        const result = createHttpClient()
          .post('/x', 'a', {
            ...extra,
            signal: controller.signal,
            timeout: 1000,
          })
          .catch((e: unknown) => e)
        if (ending === 'canceled') controller.abort()
        if (ending === 'timed out') await vi.advanceTimersByTimeAsync(1000)
        await result
        expect(added).toHaveBeenCalled()
        expect(removed).toHaveBeenCalledTimes(added.mock.calls.length)
        expect(vi.getTimerCount()).toBe(0)
      })
    }
  }
})

describe('the client', () => {
  it('runs prepare before sending and the handlers after', async () => {
    const { sent } = fakeNetwork((request) =>
      request.url.endsWith('/bad')
        ? { status: 500, body: {} }
        : { body: { ok: 1 } }
    )
    const failure = vi.fn(async (error: unknown) => {
      throw error
    })
    const client = createHttpClient({
      defaults: { timeout: 5 },
      prepare: (config) => ({ ...config, baseURL: '/app/' }),
      handlers: {
        success: (response) => ({ ...response, data: 'seen' as never }),
        failure,
      },
    })
    expect((await client.get('ok')).data).toBe('seen')
    expect(sent[0].url).toBe('/app/ok')
    await client.get('/bad').catch(() => {})
    expect(failure).toHaveBeenCalledTimes(1)
    expect((failure.mock.calls[0][0] as HttpError).config.timeout).toBe(5)
  })

  it('hands the failure handler what fails on the way out, but not what the success handler throws', async () => {
    fakeNetwork()
    const failure = vi.fn(async (error: unknown) => {
      throw error
    })
    const broken = new Error('prepare failed')
    const preparing = createHttpClient({
      prepare: () => {
        throw broken
      },
      handlers: { success: (response) => response, failure },
    })
    expect(await preparing.get('/x').catch((e: unknown) => e)).toBe(broken)
    expect(failure).toHaveBeenLastCalledWith(broken)

    const circular: Record<string, unknown> = {}
    circular.self = circular
    const encoding = createHttpClient({
      handlers: { success: (response) => response, failure },
    })
    await encoding.post('/x', circular).catch(() => {})
    expect(failure).toHaveBeenCalledTimes(2)

    const rejected = new Error('not this one')
    const succeeding = createHttpClient({
      handlers: {
        success: () => {
          throw rejected
        },
        failure,
      },
    })
    expect(await succeeding.get('/x').catch((e: unknown) => e)).toBe(rejected)
    expect(failure).toHaveBeenCalledTimes(2)
  })
})

// The session token goes out with the request and nowhere else: a response
// and an error keep the config, and errors are logged and passed around.
describe('the token', () => {
  const token = { Authorization: 'Bearer secret', 'X-Kept': 'yes' }
  const transports = {
    fetch: {},
    xhr: { onUploadProgress: () => {} },
  }

  for (const [by, extra] of Object.entries(transports)) {
    it(`is sent, but kept out of the response and the error (${by})`, async () => {
      const { sent } = fakeNetwork((request) =>
        request.url === '/bad' ? { status: 500, body: { e: 1 } } : {}
      )
      const client = createHttpClient({ defaults: { headers: token } })

      const response = await client.post('/ok', 'body', extra)
      const failure = (await client
        .post('/bad', 'body', extra)
        .catch((e: unknown) => e)) as HttpError

      expect(sent.map((request) => request.by)).toEqual([by, by])
      expect(sent[0].headers.authorization).toBe('Bearer secret')
      expect(sent[1].headers.authorization).toBe('Bearer secret')
      for (const config of [
        response.config,
        failure.config,
        failure.response?.config,
      ]) {
        expect(config?.headers).toEqual({ 'X-Kept': 'yes' })
      }
      expect(failure.status).toBe(500)
      expect(failure.data).toEqual({ e: 1 })
    })
  }

  it('is kept out of an error that has no response, whatever its case', async () => {
    const network = fakeNetwork(() => new Promise(() => {}))
    const client = createHttpClient({
      defaults: { headers: { authorization: 'Bearer secret' } },
    })
    const failing = client
      .post('/x', 'body', { onUploadProgress: () => {} })
      .catch((e: unknown) => e)
    network.xhrs[network.xhrs.length - 1].fail()
    const failure = (await failing) as HttpError
    expect(failure.code).toBe('ERR_NETWORK')
    expect(failure.config.headers).toEqual({})
  })
})
