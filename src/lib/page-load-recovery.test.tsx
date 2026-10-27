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

const original = window.location
let reload: ReturnType<typeof vi.fn>
let stop: (() => void) | undefined

beforeEach(() => {
  reload = vi.fn()
  Object.defineProperty(window, 'location', {
    configurable: true,
    value: { ...original, href: original.href, reload },
  })
  window.history.replaceState(null, '')
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

// The document after its one reload, opened straight on the page that failed
async function reopen(router: ReturnType<typeof setup>) {
  window.history.replaceState({ __mochiPageReload: true }, '')
  stop = startPageLoadRecovery(router)
  render(<RouterProvider router={router} />)
  await settle()
}

describe('startPageLoadRecovery', () => {
  it('reloads once when a prefetch failed inside the shell', async () => {
    sandbox()
    const router = await open(setup(lazyRouteComponent(flaky(1))))

    prefetchRoute(router, '/chat/posts/5')
    await settle()
    await clickOpen()

    expect(screen.getByText('error screen')).toBeTruthy()
    expect(reload).toHaveBeenCalledTimes(1)
  })

  it('reloads once when a click fails inside the shell', async () => {
    sandbox()
    await open(setup(lazyRouteComponent(flaky(1))))

    await clickOpen()

    expect(reload).toHaveBeenCalledTimes(1)
  })

  it('reloads once when a stylesheet the page needs fails', async () => {
    await open(
      setup(lazyRouteComponent(flaky(1, 'Unable to preload CSS for x.css')))
    )

    await clickOpen()

    expect(reload).toHaveBeenCalledTimes(1)
  })

  it("reloads after TanStack's own reload was spent in this tab", async () => {
    window.sessionStorage.setItem(`tanstack_router_reload:${MODULE_ERROR}`, '1')
    await open(setup(lazyRouteComponent(flaky(1))))

    await clickOpen()

    expect(reload).toHaveBeenCalledTimes(1)
  })

  it('shows the error screen when the reloaded entry fails again', async () => {
    sandbox()
    window.history.replaceState({ __mochiPageReload: true }, '')
    await open(setup(lazyRouteComponent(flaky(1))))

    await clickOpen()

    expect(screen.getByText('error screen')).toBeTruthy()
    expect(reload).not.toHaveBeenCalled()
  })

  it('stops reloading a page whose stylesheet keeps failing', async () => {
    const failing = flaky(Infinity, 'Unable to preload CSS for x.css')
    await reopen(setup(lazyRouteComponent(failing), '/chat/posts/5'))

    expect(screen.getByText('error screen')).toBeTruthy()
    expect(reload).not.toHaveBeenCalled()
    expect(window.history.state?.__mochiPageReload).toBe(true)
  })

  it("stops reloading a failing page once TanStack's reload is spent", async () => {
    window.sessionStorage.setItem(`tanstack_router_reload:${MODULE_ERROR}`, '1')
    await reopen(setup(lazyRouteComponent(flaky(Infinity)), '/chat/posts/5'))

    expect(screen.getByText('error screen')).toBeTruthy()
    expect(reload).not.toHaveBeenCalled()
    expect(window.history.state?.__mochiPageReload).toBe(true)
  })

  it('clears the mark once a page opens, so a later failure reloads too', async () => {
    window.history.replaceState({ __mochiPageReload: true }, '')
    await open(setup(lazyRouteComponent(flaky(0))))

    await clickOpen()

    expect(screen.getByText('post page')).toBeTruthy()
    expect(window.history.state?.__mochiPageReload).toBeUndefined()
  })

  it('leaves an error that is not page code to the error screen', async () => {
    const broken = () => {
      throw new Error('render failed')
    }
    await open(setup(broken))

    await clickOpen()

    expect(screen.getByText('error screen')).toBeTruthy()
    expect(reload).not.toHaveBeenCalled()
  })

  it('waits for the network before reloading', async () => {
    sandbox()
    await open(setup(lazyRouteComponent(flaky(1))))
    Object.defineProperty(navigator, 'onLine', {
      configurable: true,
      get: () => false,
    })

    await clickOpen()
    expect(reload).not.toHaveBeenCalled()

    Object.defineProperty(navigator, 'onLine', {
      configurable: true,
      get: () => true,
    })
    window.dispatchEvent(new Event('online'))
    expect(reload).toHaveBeenCalledTimes(1)
  })

  it('stops watching once stopped', async () => {
    sandbox()
    const router = await open(setup(lazyRouteComponent(flaky(1))))
    stop?.()
    stop = undefined

    await clickOpen()

    expect(router.options.defaultOnCatch).toBeUndefined()
    expect(reload).not.toHaveBeenCalled()
  })
})
