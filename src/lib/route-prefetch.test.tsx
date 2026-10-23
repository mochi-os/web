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
import { createAppHistory } from './app-path'
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
  vi.restoreAllMocks()
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
    // the router would leave this path as it is and match posts/$id
    ['a path outside the basepath', '/posts/5', {}],
  ])('leaves %s alone', async (_, href, attributes) => {
    const { router, importer } = setup()
    stop = startRoutePrefetch(router)

    pointer('pointerdown', link(href, attributes))
    await flush()

    expect(importer).not.toHaveBeenCalled()
  })

  it.each([
    ['a middle press', { button: 1 }],
    ['a right press', { button: 2 }],
    ['a ctrl press', { ctrlKey: true }],
    ['a cmd press', { metaKey: true }],
    ['a shift press', { shiftKey: true }],
  ])('leaves %s alone, which opens a new tab or a menu', async (_, init) => {
    const { router, importer } = setup()
    stop = startRoutePrefetch(router)

    pointer('pointerdown', link('/chat/posts/5'), init)
    await flush()

    expect(importer).not.toHaveBeenCalled()
  })

  it('leaves an alt press alone, which downloads the link', async () => {
    const { router, importer } = setup()
    stop = startRoutePrefetch(router)

    pointer('pointerdown', link('/chat/posts/5'), { altKey: true })
    await flush()

    expect(importer).not.toHaveBeenCalled()
  })

  it('stops watching once stopped', async () => {
    const { router, importer } = setup()
    const stopWatching = startRoutePrefetch(router)
    // A hover still waiting out its delay is dropped too
    pointer('pointerover', link('/chat/posts/5'))
    stopWatching()

    const a = link('/chat/posts/6')
    pointer('pointerover', a)
    pointer('pointerdown', a)
    a.focus()
    vi.advanceTimersByTime(100)
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
    for (const connection of [
      { saveData: true },
      { effectiveType: '2g' },
      { effectiveType: 'slow-2g' },
    ]) {
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

  it('does nothing in a hidden tab', async () => {
    vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden')
    const { router, importer } = setup()
    prefetchRoute(router, '/chat/posts/5')
    await flush()
    expect(importer).not.toHaveBeenCalled()
  })

  // The shell's iframe has no allow-same-origin, so reading sessionStorage
  // throws. lazyRouteComponent reads it after a failed import, and that throw
  // turns its caught failure into a rejection loadRouteChunk passes on.
  it('swallows a failed import inside the sandbox', async () => {
    vi.spyOn(window, 'sessionStorage', 'get').mockImplementation(() => {
      throw new DOMException('The document is sandboxed', 'SecurityError')
    })
    const failing = vi.fn(async (): Promise<never> => {
      throw new TypeError('Failed to fetch dynamically imported module: x.js')
    })
    const { router } = setup('/chat/', failing)
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

  it('swallows an importer that throws before returning a promise', () => {
    const throwing = vi.fn((): Promise<never> => {
      throw new Error('no promise')
    })
    const { router } = setup('/chat/', throwing)
    expect(() => prefetchRoute(router, '/chat/posts/5')).not.toThrow()
    expect(throwing).toHaveBeenCalledTimes(1)
  })
})

// A base58 fingerprint, the shape core routes as an entity
const FINGERPRINT = '2Bx7KpQmZ'

describe('prefetchRoute on an entity URL in the shell', () => {
  // Basepath "/" with the entity leading every path of this app
  function entityApp() {
    const importer = vi.fn(async () => ({ default: () => <p>post</p> }))
    const root = createRootRoute({ component: Outlet })
    const post = createRoute({
      getParentRoute: () => root,
      path: '$forum/$post',
      component: lazyRouteComponent(importer),
    })
    const router = createRouter({
      routeTree: root.addChildren([post]),
      basepath: '/',
      history: createMemoryHistory({ initialEntries: ['/'] }),
    })
    return { router, importer }
  }

  beforeEach(() => window.history.pushState({}, '', `/${FINGERPRINT}/p1`))
  afterEach(() => window.history.pushState({}, '', '/'))

  it('leaves another app on the host alone', async () => {
    const { router, importer } = entityApp()
    prefetchRoute(router, '/people/abc')
    await flush()
    expect(importer).not.toHaveBeenCalled()
  })

  it("loads this app's own entity pages", async () => {
    const { router, importer } = entityApp()
    prefetchRoute(router, `/${FINGERPRINT}/p2`)
    await flush()
    expect(importer).toHaveBeenCalledTimes(1)
  })
})

describe('prefetchRoute on an entity domain route', () => {
  const metas: HTMLMetaElement[] = []
  function meta(name: string, content: string) {
    const element = document.createElement('meta')
    element.name = name
    element.content = content
    document.head.appendChild(element)
    metas.push(element)
  }

  beforeEach(() => {
    meta('mochi:domain', '/')
    meta('mochi:fingerprint', FINGERPRINT)
  })
  afterEach(() => {
    for (const element of metas.splice(0)) element.remove()
  })

  // Links carry /<post>; the routes expect /<feed>/<post>
  it('puts back the fingerprint the history hides from links', async () => {
    const feedPage = vi.fn(async () => ({ default: () => <p>feed</p> }))
    const postPage = vi.fn(async () => ({ default: () => <p>post</p> }))
    const root = createRootRoute({ component: Outlet })
    const feed = createRoute({
      getParentRoute: () => root,
      path: '$feedId',
      component: lazyRouteComponent(feedPage),
    })
    const post = createRoute({
      getParentRoute: () => root,
      path: '$feedId/$postId',
      component: lazyRouteComponent(postPage),
    })
    const router = createRouter({
      routeTree: root.addChildren([feed, post]),
      basepath: '/',
      history: createAppHistory(),
    })

    prefetchRoute(router, '/p1')
    await flush()

    expect(postPage).toHaveBeenCalledTimes(1)
    expect(feedPage).not.toHaveBeenCalled()
  })
})
