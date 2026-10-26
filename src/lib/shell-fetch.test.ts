// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: Apache-2.0

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import type { AxiosAdapter, AxiosError, AxiosResponse } from 'axios'

// The app runs in the shell's sandboxed iframe: window.parent is the shell,
// whose document is out of reach, and every message from it carries it as the
// source (see shell-bridge.test.ts).
let posted: Array<Record<string, unknown>>

beforeEach(() => {
  posted = []
  // One object for the whole test: the bridge compares every message's source
  // with window.parent by identity.
  const parent = {
    postMessage: (message: unknown) => {
      posted.push(message as Record<string, unknown>)
    },
    get document(): never {
      throw new DOMException('Blocked', 'SecurityError')
    },
  }
  Object.defineProperty(window, 'parent', {
    configurable: true,
    get() {
      return parent
    },
  })
  window.history.replaceState({}, '', '/feeds/abc')
})

afterEach(() => {
  Object.defineProperty(window, 'parent', {
    configurable: true,
    get() {
      return window
    },
  })
  window.history.replaceState({}, '', '/')
  vi.restoreAllMocks()
  vi.resetModules()
})

function fromParent(data: unknown) {
  const event = new MessageEvent('message', {
    data,
    origin: window.location.origin,
  })
  Object.defineProperty(event, 'source', {
    value: window.parent,
    configurable: true,
  })
  window.dispatchEvent(event)
}

function requests() {
  return posted.filter((message) => message.type === 'fetch')
}

function aborts() {
  return posted.filter((message) => message.type === 'fetch.abort')
}

function header(message: Record<string, unknown>, name: string) {
  const pairs = message.headers as Array<[string, string]>
  const pair = pairs.find(([key]) => key.toLowerCase() === name.toLowerCase())
  return pair ? pair[1] : undefined
}

function json(value: unknown): ArrayBuffer {
  return new TextEncoder().encode(JSON.stringify(value)).buffer as ArrayBuffer
}

// The shell's answer to the one request it was asked to carry.
async function answer(reply: Record<string, unknown>) {
  await vi.waitFor(() => expect(requests()).toHaveLength(1))
  fromParent({ type: 'fetch.result', id: requests()[0].id, ...reply })
}

// boot starts the app as the shell would: the init message, carrying the
// bridge flag unless told otherwise, then the app's clients. The direct path
// is axios's own adapter, replaced here by one that records the request.
async function boot(options: { bridge?: boolean } = {}) {
  const bridge = await import('./shell-bridge')
  const init = bridge.initShellBridge()
  fromParent({
    type: 'init',
    token: 'app-token',
    inShell: true,
    ...(options.bridge === false ? {} : { fetch: true }),
  })
  await init
  const { useAuthStore } = await import('../stores/auth-store')
  useAuthStore.setState({ token: 'app-token' })

  const axios = (await import('axios')).default
  const direct = vi.fn<AxiosAdapter>(async (config) => ({
    data: 'direct',
    status: 200,
    statusText: 'OK',
    headers: {},
    config,
  }))
  vi.spyOn(axios, 'getAdapter').mockReturnValue(direct)

  const { createAppClient } = await import('./create-app-client')
  const { apiClient } = await import('./api-client')
  return { client: createAppClient({ appName: 'feeds' }), apiClient, direct }
}

describe('requests through the shell', () => {
  it('sends an app request through the shell with its own headers', async () => {
    const { client, direct } = await boot()
    const result = client.get('list', { params: { page: 2 } })

    await answer({
      status: 200,
      statusText: 'OK',
      headers: [['content-type', 'application/json']],
      body: json({ data: { items: [1, 2] } }),
    })

    expect(await result).toEqual({ data: { items: [1, 2] } })
    const request = requests()[0]
    expect(request.url).toBe(`${window.location.origin}/feeds/list?page=2`)
    expect(request.method).toBe('GET')
    expect(header(request, 'Authorization')).toBe('Bearer app-token')
    // No body, no type, as axios's own adapter sends it.
    expect(header(request, 'Content-Type')).toBeUndefined()
    expect(request.body).toBeUndefined()
    expect(direct).not.toHaveBeenCalled()
  })

  it("carries the core client's requests in this app too", async () => {
    const { apiClient, direct } = await boot()
    const result = apiClient.get('settings')

    await answer({ status: 200, headers: [], body: json({ data: 'core' }) })

    expect((await result).data).toEqual({ data: 'core' })
    const request = requests()[0]
    expect(request.url).toBe(`${window.location.origin}/feeds/settings`)
    expect(header(request, 'Authorization')).toBe('Bearer app-token')
    expect(direct).not.toHaveBeenCalled()
  })

  it('rejects a refusing status as axios does, with the response', async () => {
    const { client } = await boot()
    const result = client.get('missing')

    await answer({
      status: 404,
      statusText: 'Not Found',
      headers: [['content-type', 'application/json']],
      body: json({ error: 'not_found' }),
    })

    const error = (await result.catch((e: unknown) => e)) as AxiosError
    expect(error.code).toBe('ERR_BAD_REQUEST')
    expect(error.response?.status).toBe(404)
    expect(error.response?.data).toEqual({ error: 'not_found' })
  })

  it('carries a JSON body with its type', async () => {
    const { client } = await boot()
    const result = client.post('save', { name: 'x' })

    await answer({ status: 200, headers: [], body: json({ ok: true }) })

    expect(await result).toEqual({ ok: true })
    const request = requests()[0]
    expect(request.method).toBe('POST')
    expect(request.body).toBe('{"name":"x"}')
    expect(header(request, 'Content-Type')).toBe('application/json')
  })

  it('carries a form as its entries, leaving the boundary to the browser', async () => {
    const { client } = await boot()
    const form = new FormData()
    form.append('title', 'Hello')
    form.append('file', new File(['bytes'], 'notes.txt'))
    const result = client.post('upload', form)

    await answer({ status: 200, headers: [], body: json({ ok: true }) })
    await result

    const request = requests()[0]
    const entries = (request.body as { form: Array<[string, unknown]> }).form
    expect(entries[0]).toEqual(['title', 'Hello'])
    expect(entries[1][0]).toBe('file')
    expect((entries[1][1] as File).name).toBe('notes.txt')
    expect(header(request, 'Content-Type')).toBeUndefined()
  })

  it('returns binary bodies as the response type asks', async () => {
    const { client } = await boot()
    const bytes = new Uint8Array([1, 2, 3]).buffer
    const result = client.instance.get('file', { responseType: 'arraybuffer' })
    await answer({ status: 200, headers: [], body: bytes })
    expect(new Uint8Array((await result).data as ArrayBuffer)).toEqual(
      new Uint8Array([1, 2, 3])
    )
  })

  it('returns a blob typed from the response', async () => {
    const { client } = await boot()
    const result = client.instance.get('image', { responseType: 'blob' })
    await answer({
      status: 200,
      headers: [['content-type', 'image/png']],
      body: new Uint8Array([9]).buffer,
    })
    const blob = (await result).data as Blob
    expect(blob.type).toBe('image/png')
    expect(blob.size).toBe(1)
  })
})

describe('requests that go direct', () => {
  it('under a shell without the bridge', async () => {
    const { client, direct } = await boot({ bridge: false })
    expect(await client.get('list')).toBe('direct')
    expect(direct).toHaveBeenCalledTimes(1)
    expect(requests()).toHaveLength(0)
  })

  it('when the request reports progress', async () => {
    const { client, direct } = await boot()
    await client.post('upload', 'x', { onUploadProgress: () => {} })
    await client.get('download', { onDownloadProgress: () => {} })
    expect(direct).toHaveBeenCalledTimes(2)
    expect(requests()).toHaveLength(0)
  })

  it('outside this app, core routes included', async () => {
    const { apiClient, direct } = await boot()
    await apiClient.get('/people/abc/-/style')
    await apiClient.post('/_/identity')
    await apiClient.get('https://elsewhere.example/feeds/list')
    expect(direct).toHaveBeenCalledTimes(3)
    expect(requests()).toHaveLength(0)
  })

  it('when the shell refuses, or will not follow a redirect on a read', async () => {
    const { client, direct } = await boot()
    const refused = client.get('one')
    await answer({ refused: true })
    expect(await refused).toBe('direct')

    posted.length = 0
    const redirected = client.get('two')
    await answer({ redirect: true })
    expect(await redirected).toBe('direct')
    expect(direct).toHaveBeenCalledTimes(2)
  })

  it('but a write that met a redirect is not repeated', async () => {
    const { client, direct } = await boot()
    const result = client.post('save', { name: 'x' })
    await answer({ redirect: true })
    const error = (await result.catch((e: unknown) => e)) as AxiosError
    expect(error.code).toBe('ERR_BAD_RESPONSE')
    expect(direct).not.toHaveBeenCalled()
  })
})

describe('ending a carried request', () => {
  it('cancels through the shell when the caller aborts', async () => {
    const { client } = await boot()
    const controller = new AbortController()
    const result = client.get('slow', { signal: controller.signal })
    await vi.waitFor(() => expect(requests()).toHaveLength(1))

    controller.abort()
    const error = (await result.catch((e: unknown) => e)) as AxiosError
    expect(error.code).toBe('ERR_CANCELED')
    expect(aborts()).toEqual([{ type: 'fetch.abort', id: requests()[0].id }])

    // The shell's late answer finds nobody waiting.
    fromParent({
      type: 'fetch.result',
      id: requests()[0].id,
      status: 200,
      headers: [],
      body: json({}),
    })
  })

  it('times out through the shell', async () => {
    const { client } = await boot()
    const result = client.get('slow', { timeout: 20 })
    const error = (await result.catch((e: unknown) => e)) as AxiosError
    expect(error.code).toBe('ECONNABORTED')
    expect(aborts()).toHaveLength(1)
    expect(aborts()[0].id).toBe(requests()[0].id)
  })

  it('draws request ids nobody can guess', async () => {
    const { client } = await boot()
    const first = client.get('one')
    const second = client.get('two')
    await vi.waitFor(() => expect(requests()).toHaveLength(2))
    const ids = requests().map((request) => request.id as string)
    for (const id of ids) expect(id).toMatch(/^[0-9a-f]{32}$/)
    expect(ids[0]).not.toBe(ids[1])

    // Answers to ids this page never drew - another page's, from before an
    // app navigated the frame here - settle nothing.
    for (const id of [1, 2, '1']) {
      fromParent({
        type: 'fetch.result',
        id,
        status: 200,
        headers: [],
        body: json('forged'),
      })
    }
    for (const [index, id] of ids.entries()) {
      fromParent({
        type: 'fetch.result',
        id,
        status: 200,
        headers: [],
        body: json(`real ${index}`),
      })
    }
    expect(await first).toBe('real 0')
    expect(await second).toBe('real 1')
  })

  it('reports a failed request as a network error', async () => {
    const { client } = await boot()
    const result = client.get('list')
    await answer({ failed: true })
    const error = (await result.catch((e: unknown) => e)) as AxiosError
    expect(error.code).toBe('ERR_NETWORK')
    expect((error as { response?: AxiosResponse }).response).toBeUndefined()
  })
})
