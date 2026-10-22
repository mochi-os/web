// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: Apache-2.0

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, render, screen } from '@testing-library/react'
import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  lazyRouteComponent,
  Outlet,
  RouterProvider,
} from '@tanstack/react-router'
import { prefetchRoute, startRoutePrefetch } from './route-prefetch'

// A router shaped like an app's: a basepath, preload off, a root loader, and a
// code-split page with its own loader and beforeLoad.
function setup(
  basepath = '/chat/',
  importer = vi.fn(async () => ({ default: () => <p>post page</p> }))
) {
  const rootLoader = vi.fn(async () => {})
  const loader = vi.fn(async () => ({}))
  const beforeLoad = vi.fn(async () => {})
  const root = createRootRoute({ component: Outlet, loader: rootLoader })
  const home = createRoute({
    getParentRoute: () => root,
    path: '/',
    component: () => <p>home</p>,
  })
  const post = createRoute({
    getParentRoute: () => root,
    path: 'posts/$id',
    loader,
    beforeLoad,
    component: lazyRouteComponent(importer),
  })
  const router = createRouter({
    routeTree: root.addChildren([home, post]),
    basepath,
    history: createMemoryHistory({ initialEntries: [basepath] }),
    defaultPreload: false,
  })
  return { router, importer, loader, beforeLoad, rootLoader }
}

function link(href: string, attributes: Record<string, string> = {}) {
  const a = document.createElement('a')
  a.href = href
  a.textContent = 'open'
  for (const [name, value] of Object.entries(attributes))
    a.setAttribute(name, value)
  document.body.appendChild(a)
  return a
}

function pointer(type: string, target: Element, init: PointerEventInit = {}) {
  target.dispatchEvent(
    new PointerEvent(type, { bubbles: true, pointerType: 'mouse', ...init })
  )
}

// Let queued imports settle
const flush = () => act(async () => {})

let stop: (() => void) | undefined

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true })
})

afterEach(() => {
  stop?.()
  stop = undefined
  document.body.innerHTML = ''
  vi.useRealTimers()
  vi.unstubAllGlobals()
  Object.defineProperty(navigator, 'onLine', {
    configurable: true,
    get: () => true,
  })
})

describe('startRoutePrefetch', () => {
  it('loads the page code on hover and runs no loader or beforeLoad', async () => {
    const { router, importer, loader, beforeLoad, rootLoader } = setup()
    render(<RouterProvider router={router} />)
    await screen.findByText('home')
    const rootCalls = rootLoader.mock.calls.length
    stop = startRoutePrefetch(router)

    pointer('pointerover', link('/chat/posts/5'))
    vi.advanceTimersByTime(100)
    await flush()

    expect(importer).toHaveBeenCalledTimes(1)
    expect(loader).not.toHaveBeenCalled()
    expect(beforeLoad).not.toHaveBeenCalled()
    expect(rootLoader).toHaveBeenCalledTimes(rootCalls)
  })

  it('imports a page once however often it is hovered', async () => {
    const { router, importer } = setup()
    stop = startRoutePrefetch(router)
    const a = link('/chat/posts/5')
    const b = link('/chat/posts/6')

    for (const target of [a, b, a]) {
      pointer('pointerover', target)
      vi.advanceTimersByTime(100)
      pointer('pointerout', target)
    }
    await flush()

    expect(importer).toHaveBeenCalledTimes(1)
  })

  it('fetches nothing when the mouse only passes over a link', async () => {
    const { router, importer } = setup()
    stop = startRoutePrefetch(router)
    const a = link('/chat/posts/5')

    pointer('pointerover', a)
    vi.advanceTimersByTime(40)
    pointer('pointerout', a, { relatedTarget: document.body })
    vi.advanceTimersByTime(200)
    await flush()

    expect(importer).not.toHaveBeenCalled()
  })

  it('ignores hover from touch, which fires with the press', async () => {
    const { router, importer } = setup()
    stop = startRoutePrefetch(router)

    pointer('pointerover', link('/chat/posts/5'), { pointerType: 'touch' })
    vi.advanceTimersByTime(200)
    await flush()

    expect(importer).not.toHaveBeenCalled()
  })

  it('loads straight away on a press or keyboard focus', async () => {
    const pressed = setup()
    stop = startRoutePrefetch(pressed.router)
    pointer('pointerdown', link('/chat/posts/5'), { pointerType: 'touch' })
    await flush()
    expect(pressed.importer).toHaveBeenCalledTimes(1)
    stop()

    const focused = setup()
    stop = startRoutePrefetch(focused.router)
    link('/chat/posts/5').focus()
    await flush()
    expect(focused.importer).toHaveBeenCalledTimes(1)
  })

  it('loads the page a button names with data-prefetch', async () => {
    const { router, importer } = setup()
    stop = startRoutePrefetch(router)
    const button = document.createElement('button')
    button.setAttribute('data-prefetch', '/chat/posts/new')
    document.body.appendChild(button)

    pointer('pointerdown', button)
    await flush()

    expect(importer).toHaveBeenCalledTimes(1)
  })

  it.each([
    ['another host', 'https://elsewhere.example/chat/posts/5', {}],
    ['a new tab', '/chat/posts/5', { target: '_blank' }],
    ['a download', '/chat/posts/5', { download: '' }],
    ['an opted-out link', '/chat/posts/5', { 'data-no-prefetch': '' }],
  ])('leaves %s alone', async (_, href, attributes) => {
    const { router, importer } = setup()
    stop = startRoutePrefetch(router)

    pointer('pointerdown', link(href, attributes))
    await flush()

    expect(importer).not.toHaveBeenCalled()
  })

  it('stops watching once stopped', async () => {
    const { router, importer } = setup()
    startRoutePrefetch(router)()

    pointer('pointerdown', link('/chat/posts/5'))
    await flush()

    expect(importer).not.toHaveBeenCalled()
  })
})

describe('prefetchRoute', () => {
  it('maps the href through the basepath', async () => {
    const { router, importer } = setup('/forums/abc123def/')
    prefetchRoute(router, '/forums/abc123def/posts/5')
    await flush()
    expect(importer).toHaveBeenCalledTimes(1)
  })

  it('works without a basepath', async () => {
    const { router, importer } = setup('/')
    prefetchRoute(router, '/posts/5')
    await flush()
    expect(importer).toHaveBeenCalledTimes(1)
  })

  it('does nothing with data saver on or on 2G', async () => {
    for (const connection of [{ saveData: true }, { effectiveType: '2g' }]) {
      vi.stubGlobal('navigator', { ...navigator, connection })
      const { router, importer } = setup()
      prefetchRoute(router, '/chat/posts/5')
      await flush()
      expect(importer).not.toHaveBeenCalled()
    }
  })

  it('does nothing offline', async () => {
    Object.defineProperty(navigator, 'onLine', {
      configurable: true,
      get: () => false,
    })
    const { router, importer } = setup()
    prefetchRoute(router, '/chat/posts/5')
    await flush()
    expect(importer).not.toHaveBeenCalled()
  })

  // lazyRouteComponent catches its own import failure; a route split with
  // .lazy() does not, and its rejection reaches loadRouteChunk
  it('swallows a failed import', async () => {
    const failing = vi.fn(async (): Promise<never> => {
      throw new Error('Failed to fetch dynamically imported module: x.js')
    })
    const root = createRootRoute({ component: Outlet })
    const post = createRoute({
      getParentRoute: () => root,
      path: 'posts/$id',
    }).lazy(failing)
    const router = createRouter({
      routeTree: root.addChildren([post]),
      basepath: '/chat/',
      history: createMemoryHistory({ initialEntries: ['/chat/'] }),
    })
    const rejections: unknown[] = []
    const onRejection = (reason: unknown) => rejections.push(reason)
    process.on('unhandledRejection', onRejection)

    expect(() => prefetchRoute(router, '/chat/posts/5')).not.toThrow()
    await flush()
    await new Promise((resolve) => setTimeout(resolve, 0))
    process.off('unhandledRejection', onRejection)

    expect(failing).toHaveBeenCalledTimes(1)
    expect(rejections).toEqual([])
  })
})
