// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: Apache-2.0

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, render, screen } from '@testing-library/react'
import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  lazyRouteComponent,
  Link,
  Outlet,
  RouterProvider,
} from '@tanstack/react-router'
import { startPageLoadRecovery } from './page-load-recovery'
import { prefetchRoute } from './route-prefetch'

const MODULE_ERROR =
  'Failed to fetch dynamically imported module: /chat/assets/post-x.js'

// A page import that fails `failures` times with `message`, then loads
function flaky(failures: number, message = MODULE_ERROR) {
  let calls = 0
  return vi.fn(async () => {
    calls++
    if (calls <= failures) throw new TypeError(message)
    return { default: () => <p>post page</p> }
  })
}

function setup(
  component: ReturnType<typeof lazyRouteComponent> | (() => never),
  start = '/chat/'
) {
  const root = createRootRoute({
    component: () => (
      <>
        <Link to='/posts/$id' params={{ id: '5' }}>
          open
        </Link>
        <Outlet />
      </>
    ),
    errorComponent: () => <p>error screen</p>,
  })
  const home = createRoute({
    getParentRoute: () => root,
    path: '/',
    component: () => <p>home</p>,
  })
  const post = createRoute({
    getParentRoute: () => root,
    path: 'posts/$id',
    component,
    errorComponent: () => <p>error screen</p>,
  })
  return createRouter({
    routeTree: root.addChildren([home, post]),
    basepath: '/chat/',
    history: createMemoryHistory({ initialEntries: [start] }),
    defaultPreload: false,
  })
}

const settle = async () => {
  for (let i = 0; i < 6; i++)
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0))
    })
}

// The shell's iframe has no allow-same-origin, so sessionStorage throws
function sandbox() {
  vi.spyOn(window, 'sessionStorage', 'get').mockImplementation(() => {
    throw new DOMException('The document is sandboxed', 'SecurityError')
  })
}

// The server's iframe shim: an in-memory stand-in for sessionStorage, which
// the shell's frame cannot read, emptied by every reload
function shim() {
  const items = new Map<string, string>()
  const storage = {
    getItem: (key: string) => items.get(key) ?? null,
    setItem: (key: string, value: string) => {
      items.set(key, String(value))
    },
    removeItem: (key: string) => {
      items.delete(key)
    },
    clear: () => items.clear(),
  }
  vi.spyOn(window, 'sessionStorage', 'get').mockReturnValue(
    storage as unknown as Storage
  )
  return storage
}

const original = window.location
let reload: ReturnType<typeof vi.fn>
let replace: ReturnType<typeof vi.fn>
let stop: (() => void) | undefined

// The address the document was loaded at
function loadedAt(path: string) {
  Object.defineProperty(window, 'location', {
    configurable: true,
    value: {
      ...original,
      href: new URL(path, original.origin).href,
      reload,
      replace,
    },
  })
}

beforeEach(() => {
  reload = vi.fn()
  replace = vi.fn()
  loadedAt('/chat/')
})

afterEach(() => {
  stop?.()
  stop = undefined
  Object.defineProperty(window, 'location', {
    configurable: true,
    value: original,
  })
  Object.defineProperty(navigator, 'onLine', {
    configurable: true,
    get: () => true,
  })
  vi.restoreAllMocks()
  try {
    window.sessionStorage.clear()
  } catch {
    // sandboxed
  }
})

async function open(router: ReturnType<typeof setup>) {
  render(<RouterProvider router={router} />)
  await screen.findByText('home')
  stop = startPageLoadRecovery(router)
  return router
}

async function clickOpen() {
  fireEvent.click(screen.getByText('open'))
  await settle()
}

// A document opened straight on the post page, as a reload leaves it
async function openPost(component: ReturnType<typeof lazyRouteComponent>) {
  const router = setup(component, '/chat/posts/5')
  stop = startPageLoadRecovery(router)
  render(<RouterProvider router={router} />)
  await settle()
}

function setOnline(online: boolean) {
  Object.defineProperty(navigator, 'onLine', {
    configurable: true,
    get: () => online,
  })
}

const POST_RELOAD = new URL('/chat/posts/5?_reload=1', original.origin).href

describe('startPageLoadRecovery', () => {
  it('loads the page again when a prefetch failed inside the shell', async () => {
    sandbox()
    const router = await open(setup(lazyRouteComponent(flaky(1))))

    prefetchRoute(router, '/chat/posts/5')
    await settle()
    await clickOpen()

    expect(screen.getByText('error screen')).toBeTruthy()
    expect(replace).toHaveBeenCalledExactlyOnceWith(POST_RELOAD)
  })

  it('loads the page again when a click fails inside the shell', async () => {
    sandbox()
    await open(setup(lazyRouteComponent(flaky(1))))

    await clickOpen()

    expect(replace).toHaveBeenCalledExactlyOnceWith(POST_RELOAD)
  })

  it('loads the page again when a stylesheet it needs fails', async () => {
    await open(
      setup(lazyRouteComponent(flaky(1, 'Unable to preload CSS for x.css')))
    )

    await clickOpen()

    expect(replace).toHaveBeenCalledExactlyOnceWith(POST_RELOAD)
  })

  it("loads the page again after TanStack's own reload was spent", async () => {
    window.sessionStorage.setItem(`tanstack_router_reload:${MODULE_ERROR}`, '1')
    await open(setup(lazyRouteComponent(flaky(1))))

    await clickOpen()

    expect(replace).toHaveBeenCalledExactlyOnceWith(POST_RELOAD)
  })

  it("loads the page again under the server's storage shim", async () => {
    shim()
    await open(setup(lazyRouteComponent(flaky(1))))

    await clickOpen()

    expect(screen.getByText('error screen')).toBeTruthy()
    expect(reload).not.toHaveBeenCalled()
    expect(replace).toHaveBeenCalledExactlyOnceWith(POST_RELOAD)
  })

  it('shows the error screen when the page loaded again fails under the shim', async () => {
    shim()
    loadedAt('/chat/posts/5?_shell=1&_reload=1')
    await openPost(lazyRouteComponent(flaky(Infinity)))

    expect(screen.getByText('error screen')).toBeTruthy()
    expect(reload).not.toHaveBeenCalled()
    expect(replace).not.toHaveBeenCalled()
  })

  it("leaves TanStack's own reload to a real sessionStorage", async () => {
    await open(setup(lazyRouteComponent(flaky(1))))

    await clickOpen()

    expect(reload).toHaveBeenCalled()
    expect(replace).not.toHaveBeenCalled()
    expect(Object.keys(window.sessionStorage)).toEqual([
      `tanstack_router_reload:${MODULE_ERROR}`,
    ])
  })

  it('gives the shim its own storage back once stopped', async () => {
    const storage = shim()
    const getItem = storage.getItem
    await open(setup(lazyRouteComponent(flaky(1))))

    stop?.()
    stop = undefined

    expect(storage.getItem).toBe(getItem)
  })

  it('takes the reload mark off the address outside the shell', async () => {
    window.sessionStorage.setItem(`tanstack_router_reload:${MODULE_ERROR}`, '1')
    loadedAt('/chat/posts/5?_reload=1')
    const router = setup(
      lazyRouteComponent(flaky(Infinity)),
      '/chat/posts/5?_reload=1'
    )
    stop = startPageLoadRecovery(router)

    expect(router.history.location.href).toBe('/chat/posts/5')
    expect(router.latestLocation.search).toEqual({})

    render(<RouterProvider router={router} />)
    await settle()

    expect(screen.getByText('error screen')).toBeTruthy()
    expect(replace).not.toHaveBeenCalled()
  })

  it("leaves the reload mark on a shell frame's address", async () => {
    loadedAt('/chat/posts/5?_shell=1&_reload=1')
    const router = setup(
      lazyRouteComponent(flaky(Infinity)),
      '/chat/posts/5?_shell=1&_reload=1'
    )
    stop = startPageLoadRecovery(router)

    expect(router.history.location.href).toBe(
      '/chat/posts/5?_shell=1&_reload=1'
    )
  })

  it('keeps the shell marker on the address it loads', async () => {
    sandbox()
    loadedAt('/chat/?_shell=1')
    await open(setup(lazyRouteComponent(flaky(1))))

    await clickOpen()

    expect(replace).toHaveBeenCalledExactlyOnceWith(
      new URL('/chat/posts/5?_reload=1&_shell=1', original.origin).href
    )
  })

  it('shows the error screen when the page loaded again fails inside the shell', async () => {
    sandbox()
    loadedAt('/chat/posts/5?_shell=1&_reload=1')
    await openPost(lazyRouteComponent(flaky(Infinity)))

    expect(screen.getByText('error screen')).toBeTruthy()
    expect(replace).not.toHaveBeenCalled()
  })

  it('shows the error screen when a stylesheet keeps failing', async () => {
    loadedAt('/chat/posts/5?_reload=1')
    await openPost(
      lazyRouteComponent(flaky(Infinity, 'Unable to preload CSS for x.css'))
    )

    expect(screen.getByText('error screen')).toBeTruthy()
    expect(replace).not.toHaveBeenCalled()
  })

  it("shows the error screen when a page keeps failing after TanStack's reload", async () => {
    window.sessionStorage.setItem(`tanstack_router_reload:${MODULE_ERROR}`, '1')
    loadedAt('/chat/posts/5?_reload=1')
    await openPost(lazyRouteComponent(flaky(Infinity)))

    expect(screen.getByText('error screen')).toBeTruthy()
    expect(replace).not.toHaveBeenCalled()
  })

  it('loads another page again that fails after a reload', async () => {
    sandbox()
    loadedAt('/chat/?_reload=1')
    await open(setup(lazyRouteComponent(flaky(1))))

    await clickOpen()

    expect(replace).toHaveBeenCalledExactlyOnceWith(POST_RELOAD)
  })

  it('leaves an error that is not page code to the error screen', async () => {
    const broken = () => {
      throw new Error('render failed')
    }
    await open(setup(broken))

    await clickOpen()

    expect(screen.getByText('error screen')).toBeTruthy()
    expect(replace).not.toHaveBeenCalled()
  })

  it('waits for the network before loading the page again', async () => {
    sandbox()
    await open(setup(lazyRouteComponent(flaky(1))))
    setOnline(false)

    await clickOpen()
    expect(replace).not.toHaveBeenCalled()

    setOnline(true)
    window.dispatchEvent(new Event('online'))
    expect(replace).toHaveBeenCalledExactlyOnceWith(POST_RELOAD)
  })

  it('leaves a page the user moved on to while offline', async () => {
    sandbox()
    const router = await open(setup(lazyRouteComponent(flaky(1))))
    setOnline(false)
    await clickOpen()

    await act(async () => {
      await router.navigate({ to: '/' })
    })
    await settle()
    setOnline(true)
    window.dispatchEvent(new Event('online'))

    expect(screen.getByText('home')).toBeTruthy()
    expect(replace).not.toHaveBeenCalled()
  })

  it('stops watching once stopped', async () => {
    sandbox()
    const router = await open(setup(lazyRouteComponent(flaky(1))))
    stop?.()
    stop = undefined

    await clickOpen()

    expect(router.options.defaultOnCatch).toBeUndefined()
    expect(replace).not.toHaveBeenCalled()
  })
})
