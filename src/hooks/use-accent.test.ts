// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: Apache-2.0

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const shell = vi.hoisted(() => ({
  inside: true,
  asset: 'asset-token' as string | undefined,
  carried: null as null | {
    status: number
    headers: Array<[string, string]>
    body: ArrayBuffer
  },
  asked: [] as Array<{ url: string; headers: Array<[string, string]> }>,
}))

vi.mock('../lib/shell-bridge', () => ({
  isInShell: () => shell.inside,
  getShellInitData: () => ({
    asset: shell.asset,
    token: 'app-token',
    fetch: true,
  }),
  // As the real one: this origin, under this app's path.
  isOwnResource: (url: string) => {
    const resolved = new URL(url, document.baseURI)
    return (
      resolved.origin === window.location.origin &&
      resolved.pathname.startsWith('/forums/')
    )
  },
}))

vi.mock('../lib/shell-fetch', () => ({
  shellGet: (url: string, headers: Array<[string, string]>) => {
    shell.asked.push({ url, headers })
    return Promise.resolve(shell.carried)
  },
}))

import { fetchStyle } from './use-accent'

const fetched: Array<{ url: string; init?: RequestInit }> = []

beforeEach(() => {
  shell.inside = true
  shell.asset = 'asset-token'
  shell.carried = null
  shell.asked = []
  fetched.length = 0
  vi.stubGlobal('fetch', (url: string, init?: RequestInit) => {
    fetched.push({ url, init })
    return Promise.resolve(
      new Response(JSON.stringify({ data: { accent: '#123456' } }), {
        status: 200,
      })
    )
  })
})

afterEach(() => {
  vi.unstubAllGlobals()
})

const STYLE = '/forums/abcdefghi/-/0123456789abcdef0123456789abcdef/asset/style'

describe('fetchStyle', () => {
  it('sends the read-only asset token in the shell, never the app token', async () => {
    expect(await fetchStyle(STYLE)).toEqual({ accent: '#123456' })
    expect(shell.asked[0].headers).toEqual([
      ['Authorization', 'Bearer asset-token'],
    ])
    expect(fetched).toHaveLength(1)
    const headers = fetched[0].init?.headers as Record<string, string>
    expect(headers.Authorization).toBe('Bearer asset-token')
    expect(fetched[0].init?.credentials).toBe('omit')
  })

  it('reads the style the shell carried', async () => {
    shell.carried = {
      status: 200,
      headers: [['content-type', 'application/json']],
      body: new TextEncoder().encode('{"data":{"accent":"#abcdef"}}')
        .buffer as ArrayBuffer,
    }
    expect(await fetchStyle(STYLE)).toEqual({ accent: '#abcdef' })
    expect(fetched).toHaveLength(0)
  })

  it('in a shell with no asset token, sends no token at all, the app token least of all', async () => {
    shell.asset = undefined
    expect(await fetchStyle(STYLE)).toEqual({ accent: '#123456' })
    expect(shell.asked[0].headers).toEqual([])
    fetched.length = 0
    expect(await fetchStyle('/people/x/-/style')).toEqual({
      accent: '#123456',
    })
    expect(fetched[0].init?.headers).toEqual({})
  })

  it("fetches another app's shared style with the asset token, not through the shell", async () => {
    // People's style is shared: every app's avatars and the shell menu's own
    // avatar embed it. The asset token is honoured only on asset routes.
    expect(await fetchStyle('/people/x/-/style')).toEqual({
      accent: '#123456',
    })
    expect(shell.asked).toHaveLength(0)
    const headers = fetched[0].init?.headers as Record<string, string>
    expect(headers.Authorization).toBe('Bearer asset-token')
    expect(fetched[0].init?.credentials).toBe('omit')
  })

  it('fetches nothing for an address that climbs out of its route or leaves the server', async () => {
    for (const url of [
      '/forums/abcdefghi/-/../../-/delete/asset/style',
      '/forums/abcdefghi/-/x/..%2F..%2Fdelete/asset/style',
      'https://evil.example/forums/x/asset/style',
      '//evil.example/forums/x/asset/style',
    ]) {
      expect(await fetchStyle(url)).toEqual({})
    }
    expect(shell.asked).toHaveLength(0)
    expect(fetched).toHaveLength(0)
  })

  it('outside the shell sends the page session and no token', async () => {
    shell.inside = false
    expect(await fetchStyle(STYLE)).toEqual({ accent: '#123456' })
    expect(fetched[0].init?.credentials).toBe('same-origin')
    expect(fetched[0].init?.headers).toBeUndefined()
  })
})
