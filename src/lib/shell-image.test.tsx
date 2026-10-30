// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: Apache-2.0

import { act, render } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// The page runs in the shell's sandboxed iframe: window.parent is the shell,
// whose document is out of reach (see shell-fetch.test.ts).
let posted: Array<Record<string, unknown>>
let made: number

beforeEach(() => {
  posted = []
  made = 0
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
  // jsdom has no object URLs.
  URL.createObjectURL = vi.fn(() => `blob:mochi/${++made}`)
  URL.revokeObjectURL = vi.fn()
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
  vi.unstubAllGlobals()
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

const requests = () => posted.filter((message) => message.type === 'fetch')

const PNG = new Uint8Array([137, 80, 78, 71]).buffer

async function boot(options: { bridge?: boolean } = {}) {
  const bridge = await import('./shell-bridge')
  const init = bridge.initShellBridge()
  fromParent({
    type: 'init',
    token: 'app-token',
    asset: 'asset-token',
    inShell: true,
    ...(options.bridge === false ? {} : { fetch: true }),
  })
  await init
  return (await import('../components/asset-image')).AssetImage
}

async function answer(index: number, reply: Record<string, unknown>) {
  await vi.waitFor(() => expect(requests().length).toBeGreaterThan(index))
  await act(async () => {
    fromParent({ type: 'fetch.result', id: requests()[index].id, ...reply })
  })
}

const image = (type = 'image/png') => ({
  status: 200,
  headers: [['content-type', type]],
  body: PNG,
})

const THUMBNAIL = '/feeds/abc/-/attachments/x/thumbnail'

describe('images through the shell', () => {
  it("fetches this app's image through the shell, its token in a header and none in the URL", async () => {
    const AssetImage = await boot()
    const view = render(
      <AssetImage src={THUMBNAIL + '?token=asset-token'} alt='Photo' />
    )
    await answer(0, image())

    const request = requests()[0]
    expect(request.url).toBe(window.location.origin + THUMBNAIL)
    expect(request.method).toBe('GET')
    // The asset token, which core honours only on asset routes and only to
    // read - never the app token, which runs any action the URL names.
    expect(request.headers).toEqual([['Authorization', 'Bearer asset-token']])
    // Revalidated each time: the address no longer differs per account.
    expect(request.cache).toBe('no-cache')
    const element = view.container.querySelector('img')!
    expect(element.getAttribute('src')).toBe('blob:mochi/1')
    expect(element.getAttribute('alt')).toBe('Photo')
  })

  it('shows nothing, not its alt text, while the shell fetches it', async () => {
    const AssetImage = await boot()
    const view = render(<AssetImage src={THUMBNAIL} alt='Photo' />)
    await vi.waitFor(() => expect(requests()).toHaveLength(1))
    const element = view.container.querySelector('img')!
    expect(element.hasAttribute('src')).toBe(false)
    expect(element.getAttribute('alt')).toBe('')
  })

  it('fetches an image once however many elements show it', async () => {
    const AssetImage = await boot()
    const view = render(
      <>
        <AssetImage src={THUMBNAIL} alt='' />
        <AssetImage src={THUMBNAIL + '?token=asset-token'} alt='' />
      </>
    )
    await answer(0, image())
    expect(requests()).toHaveLength(1)
    const sources = [...view.container.querySelectorAll('img')].map((element) =>
      element.getAttribute('src')
    )
    expect(sources).toEqual(['blob:mochi/1', 'blob:mochi/1'])
  })

  it('loads it itself when the shell refuses', async () => {
    const AssetImage = await boot()
    const src = THUMBNAIL + '?token=asset-token'
    const view = render(<AssetImage src={src} alt='' />)
    await answer(0, { refused: true })
    expect(view.container.querySelector('img')!.getAttribute('src')).toBe(src)
  })

  it('loads it itself when the server does not answer with the image', async () => {
    const AssetImage = await boot()
    const view = render(<AssetImage src={THUMBNAIL} alt='' />)
    await answer(0, {
      status: 404,
      headers: [['content-type', 'image/png']],
      body: PNG,
    })
    expect(view.container.querySelector('img')!.getAttribute('src')).toBe(
      THUMBNAIL
    )
  })

  it("keeps an SVG's own address, and the policy served with it", async () => {
    const AssetImage = await boot()
    const view = render(<AssetImage src={THUMBNAIL} alt='' />)
    await answer(0, image('image/svg+xml'))
    expect(view.container.querySelector('img')!.getAttribute('src')).toBe(
      THUMBNAIL
    )
    expect(URL.createObjectURL).not.toHaveBeenCalled()
  })

  it("leaves another app's image, and another origin's, alone", async () => {
    const AssetImage = await boot()
    const view = render(
      <>
        <AssetImage src='/people/p/-/avatar' alt='' />
        <AssetImage src='https://elsewhere.example/a.png' alt='' />
      </>
    )
    await act(async () => {})
    expect(requests()).toEqual([])
    const sources = [...view.container.querySelectorAll('img')].map((element) =>
      element.getAttribute('src')
    )
    expect(sources).toEqual([
      '/people/p/-/avatar',
      'https://elsewhere.example/a.png',
    ])
  })

  it('carries nothing without an asset token', async () => {
    const bridge = await import('./shell-bridge')
    const init = bridge.initShellBridge()
    fromParent({ type: 'init', token: 'app-token', inShell: true, fetch: true })
    await init
    const { AssetImage } = await import('../components/asset-image')
    const view = render(<AssetImage src={THUMBNAIL} alt='' />)
    // At once, not after a fetch that will not be made.
    expect(view.container.querySelector('img')!.getAttribute('src')).toBe(
      THUMBNAIL
    )
    await act(async () => {})
    expect(requests()).toEqual([])
    expect(view.container.querySelector('img')!.getAttribute('src')).toBe(
      THUMBNAIL
    )
  })

  it('loads it itself under a shell without the bridge', async () => {
    const AssetImage = await boot({ bridge: false })
    const view = render(<AssetImage src={THUMBNAIL} alt='' />)
    // At once, not after a fetch that cannot be made.
    expect(view.container.querySelector('img')!.getAttribute('src')).toBe(
      THUMBNAIL
    )
    await act(async () => {})
    expect(requests()).toEqual([])
    expect(view.container.querySelector('img')!.getAttribute('src')).toBe(
      THUMBNAIL
    )
  })

  it('fetches a lazy image only once it nears the screen', async () => {
    const observed: Array<
      (records: Array<{ isIntersecting: boolean }>) => void
    > = []
    vi.stubGlobal(
      'IntersectionObserver',
      class {
        constructor(
          callback: (records: Array<{ isIntersecting: boolean }>) => void
        ) {
          observed.push(callback)
        }
        observe() {}
        disconnect() {}
      }
    )
    const AssetImage = await boot()
    render(<AssetImage src={THUMBNAIL} alt='' loading='lazy' />)
    await act(async () => {})
    expect(requests()).toEqual([])

    await act(async () => {
      observed.forEach((callback) => callback([{ isIntersecting: true }]))
    })
    await vi.waitFor(() => expect(requests()).toHaveLength(1))
  })
})

describe('avatars through the shell', () => {
  it("fetches this app's avatar through the shell", async () => {
    await boot()
    const { EntityAvatar } = await import('../components/entity-avatar')
    const { QueryClient, QueryClientProvider } =
      await import('@tanstack/react-query')
    const view = render(
      <QueryClientProvider client={new QueryClient()}>
        <EntityAvatar src='/feeds/abc/-/avatar' name='Alice' />
      </QueryClientProvider>
    )
    await answer(0, image())
    expect(requests()[0].url).toBe(
      window.location.origin + '/feeds/abc/-/avatar'
    )
    const element = view.container.querySelector('img')!
    expect(element.getAttribute('src')).toBe('blob:mochi/1')
    expect(element.getAttribute('alt')).toBe('Avatar for Alice')
  })
})

describe('images outside the shell', () => {
  it('shows the address as given', async () => {
    Object.defineProperty(window, 'parent', {
      configurable: true,
      get() {
        return window
      },
    })
    const { AssetImage } = await import('../components/asset-image')
    const view = render(<AssetImage src={THUMBNAIL} alt='' />)
    await act(async () => {})
    expect(posted).toEqual([])
    expect(view.container.querySelector('img')!.getAttribute('src')).toBe(
      THUMBNAIL
    )
  })
})
