// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: Apache-2.0

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { loader } from './loader.js'

// The loader's own fallbacks, run directly in a frame of a shell that carries
// fetches but never answers.
let posted: Array<Record<string, unknown>>

beforeEach(() => {
  posted = []
  const parent = {
    postMessage: (message: unknown) => {
      posted.push(message as Record<string, unknown>)
    },
  }
  Object.defineProperty(window, 'parent', {
    configurable: true,
    get: () => parent,
  })
  window.name = 'mochi:bridge'
  window.history.replaceState({}, '', '/app/')
})

afterEach(() => {
  Object.defineProperty(window, 'parent', {
    configurable: true,
    get: () => window,
  })
  window.name = ''
  window.history.replaceState({}, '', '/')
  document.head.innerHTML = ''
  vi.useRealTimers()
})

describe('loader: a request the shell never answers', () => {
  it('is ended in the shell and loaded natively, in CORS mode', async () => {
    vi.useFakeTimers()
    loader([[], []], './assets/index-a.js', [])
    await vi.advanceTimersByTimeAsync(0)
    const request = posted.find((message) => message.type === 'fetch')
    expect(request?.url).toBe(window.location.origin + '/app/assets/index-a.js')
    expect(document.querySelector('script[src]')).toBeNull()

    await vi.advanceTimersByTimeAsync(60_000)
    // THE POINT: the shell's download is ended, not left to finish beside
    // the page's own.
    expect(posted).toContainEqual({ type: 'fetch.abort', id: request?.id })
    const script = document.querySelector('script[src]') as HTMLScriptElement
    expect(script.src).toBe(window.location.origin + '/app/assets/index-a.js')
    // In the sandboxed frame every URL is cross-origin; without CORS mode a
    // script's errors reach window.onerror only as "Script error.".
    expect(script.crossOrigin).toBe('anonymous')
  })

  // A slow link's download outlasts a minute, and is not ended while it moves.
  it('waits while the shell reports bytes, and ends it 15 s after they stop', async () => {
    vi.useFakeTimers()
    loader([[], []], './assets/index-a.js', [])
    await vi.advanceTimersByTimeAsync(0)
    const request = posted.find((message) => message.type === 'fetch')
    expect(request?.progress).toBe(true)
    // As the shell delivers it: from the parent, at the page's own origin.
    const report = () => {
      const event = new MessageEvent('message', {
        data: { type: 'fetch.progress', id: request?.id, received: 1 },
        origin: window.location.origin,
      })
      Object.defineProperty(event, 'source', { value: window.parent })
      window.dispatchEvent(event)
    }
    await vi.advanceTimersByTimeAsync(50_000)
    report()
    await vi.advanceTimersByTimeAsync(14_999)
    report()
    await vi.advanceTimersByTimeAsync(14_999)
    expect(posted).not.toContainEqual({ type: 'fetch.abort', id: request?.id })
    expect(document.querySelector('script[src]')).toBeNull()
    await vi.advanceTimersByTimeAsync(1)
    expect(posted).toContainEqual({ type: 'fetch.abort', id: request?.id })
    expect(document.querySelector('script[src]')).not.toBeNull()
  })

  it('preloads natively in CORS mode, so the script takes the preload up', async () => {
    window.name = ''
    loader(
      [['index-a.js', 'chunk-b.js'], [[0, [1]]]],
      './assets/index-a.js',
      []
    )
    const preload = document.querySelector(
      'link[rel="preload"]'
    ) as HTMLLinkElement
    expect(preload.href).toBe(window.location.origin + '/app/assets/chunk-b.js')
    expect(preload.crossOrigin).toBe('anonymous')
    await Promise.resolve()
    await Promise.resolve()
    const script = document.querySelector('script[src]') as HTMLScriptElement
    expect(script.crossOrigin).toBe('anonymous')
  })
})

// React's shared files: menu's copy is asked for first, and the app's own is
// the one the page needs. A shared file in the entry's closure, so it is
// asked for as the page starts.
describe("loader: menu's copy of a shared file", () => {
  const SHARED = {
    names: { react: 'shared/react-a1b2c3d4.js' },
    files: { 'shared/react-a1b2c3d4.js': 'digest' },
    menu: '/menu/assets/shared/',
  }
  const MANIFEST: [string[], Array<[number, number[]]>] = [
    ['index-a.js', 'shared/react-a1b2c3d4.js'],
    [[0, [1]]],
  ]
  const MENU = window.location.origin + '/menu/assets/shared/react-a1b2c3d4.js'
  const OWN = window.location.origin + '/app/assets/shared/react-a1b2c3d4.js'
  const asked = (url: string) =>
    posted.filter((message) => message.type === 'fetch' && message.url === url)

  // Web Crypto, which jsdom lacks and a browser in a secure context has.
  // Kept before any test: globalThis.crypto is window.crypto, so reading it
  // after afterEach has cleared it would give undefined.
  const WEB_CRYPTO = globalThis.crypto.subtle
  function subtle(value: unknown) {
    Object.defineProperty(window.crypto, 'subtle', {
      configurable: true,
      value,
    })
  }
  afterEach(() => {
    subtle(undefined)
  })

  it("asks for the app's own copy 10 s after menu's has not started", async () => {
    subtle(WEB_CRYPTO)
    vi.useFakeTimers()
    loader(MANIFEST, './assets/index-a.js', [], SHARED)
    await vi.advanceTimersByTimeAsync(0)
    const menu = asked(MENU)[0]
    expect(menu).toBeDefined()
    expect(asked(OWN)).toEqual([])

    await vi.advanceTimersByTimeAsync(9_999)
    expect(asked(OWN)).toEqual([])
    await vi.advanceTimersByTimeAsync(1)
    // THE POINT: a lost request for menu's copy holds the page 10 s, not the
    // minute a chunk is given, before the app's own copy is asked for.
    expect(posted).toContainEqual({ type: 'fetch.abort', id: menu?.id })
    expect(asked(OWN)).toHaveLength(1)
    expect(document.querySelector('script[src]')).toBeNull()
  })

  // A slow link: menu's copy starts inside 10 s and takes far longer than
  // that to finish. Seen in Chrome at 1G, react-dom-client took 59 s.
  it("waits for menu's copy while bytes come, past 10 s, and ends it 15 s after they stop", async () => {
    subtle(WEB_CRYPTO)
    vi.useFakeTimers()
    loader(MANIFEST, './assets/index-a.js', [], SHARED)
    await vi.advanceTimersByTimeAsync(0)
    const menu = asked(MENU)[0]
    expect(menu?.progress).toBe(true)
    // As the shell delivers it: from the parent, at the page's own origin.
    const report = () => {
      const event = new MessageEvent('message', {
        data: { type: 'fetch.progress', id: menu?.id, received: 1 },
        origin: window.location.origin,
      })
      Object.defineProperty(event, 'source', { value: window.parent })
      window.dispatchEvent(event)
    }
    await vi.advanceTimersByTimeAsync(9_000)
    report()
    await vi.advanceTimersByTimeAsync(14_999)
    report()
    await vi.advanceTimersByTimeAsync(14_999)
    // THE POINT: 39 s in, a download still moving is not dropped at 10 s and
    // fetched a second time from the app's own folder.
    expect(posted).not.toContainEqual({ type: 'fetch.abort', id: menu?.id })
    expect(asked(OWN)).toEqual([])
    await vi.advanceTimersByTimeAsync(1)
    expect(posted).toContainEqual({ type: 'fetch.abort', id: menu?.id })
    expect(asked(OWN)).toHaveLength(1)
  })

  // The shell's fetch threw: the network dropped, or the server closed the
  // connection.
  it("asks for the app's own copy at once when menu's fails", async () => {
    subtle(WEB_CRYPTO)
    vi.useFakeTimers()
    loader(MANIFEST, './assets/index-a.js', [], SHARED)
    await vi.advanceTimersByTimeAsync(0)
    const menu = asked(MENU)[0]
    expect(asked(OWN)).toEqual([])
    // As the shell answers it: from the parent, at the page's own origin.
    const event = new MessageEvent('message', {
      data: { type: 'fetch.result', id: menu?.id, failed: true },
      origin: window.location.origin,
    })
    Object.defineProperty(event, 'source', { value: window.parent })
    window.dispatchEvent(event)
    await vi.advanceTimersByTimeAsync(0)
    // THE POINT: a failure is an answer, so the page does not wait out the
    // 10 s first, and there is nothing left in the shell to end.
    expect(asked(OWN)).toHaveLength(1)
    expect(posted).not.toContainEqual({ type: 'fetch.abort', id: menu?.id })
  })

  it("asks only for the app's own copy where the frame has no Web Crypto", async () => {
    subtle(undefined)
    vi.useFakeTimers()
    loader(MANIFEST, './assets/index-a.js', [], SHARED)
    await vi.advanceTimersByTimeAsync(0)
    // THE POINT: menu's bytes could not be checked, so they are not fetched
    // only to be thrown away on every page view.
    expect(asked(MENU)).toEqual([])
    expect(asked(OWN)).toHaveLength(1)
  })
})
