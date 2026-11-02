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
