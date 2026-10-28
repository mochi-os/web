// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: Apache-2.0

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, render, screen } from '@testing-library/react'
import { I18nProvider } from '@lingui/react'
import { i18n } from '@lingui/core'
import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  Outlet,
  RouterProvider,
} from '@tanstack/react-router'
import { RouteError } from './route-error'

const MODULE_ERROR =
  'Failed to fetch dynamically imported module: /chat/assets/post-x.js'

// The shape of an app: __root, a layout with the sidebar, the page under it,
// and RouteError as the router's default
function setup(page: () => never | React.ReactNode) {
  const root = createRootRoute({
    component: Outlet,
    errorComponent: () => <p>root error screen</p>,
  })
  const layout = createRoute({
    getParentRoute: () => root,
    id: '_authenticated',
    component: () => (
      <>
        <nav>sidebar</nav>
        <Outlet />
      </>
    ),
  })
  const post = createRoute({
    getParentRoute: () => layout,
    path: 'posts/$id',
    component: page,
  })
  return createRouter({
    routeTree: root.addChildren([layout.addChildren([post])]),
    basepath: '/chat/',
    history: createMemoryHistory({ initialEntries: ['/chat/posts/5'] }),
    defaultPreload: false,
    defaultErrorComponent: RouteError,
  })
}

async function open(router: ReturnType<typeof setup>) {
  render(
    <I18nProvider i18n={i18n}>
      <RouterProvider router={router} />
    </I18nProvider>
  )
  await screen.findByText('sidebar')
}

const original = window.location
let replace: ReturnType<typeof vi.fn>

beforeEach(() => {
  i18n.activate('en')
  replace = vi.fn()
  Object.defineProperty(window, 'location', {
    configurable: true,
    value: { ...original, href: original.href, replace },
  })
  // React reports every caught render error; these throw on purpose
  vi.spyOn(console, 'error').mockImplementation(() => undefined)
})

afterEach(() => {
  Object.defineProperty(window, 'location', {
    configurable: true,
    value: original,
  })
  vi.restoreAllMocks()
})

describe('RouteError', () => {
  it('asks to check the connection when page code failed to load', async () => {
    await open(
      setup(() => {
        throw new TypeError(MODULE_ERROR)
      })
    )

    expect(
      await screen.findByText(
        'Please check your internet connection and try again.'
      )
    ).toBeTruthy()
    expect(screen.getByText('sidebar')).toBeTruthy()
    expect(screen.queryByText(MODULE_ERROR)).toBeNull()
  })

  it('loads such a page again from the server on Try again', async () => {
    await open(
      setup(() => {
        throw new TypeError(MODULE_ERROR)
      })
    )

    fireEvent.click(await screen.findByRole('button', { name: 'Try again' }))

    expect(replace).toHaveBeenCalledExactlyOnceWith(
      new URL('/chat/posts/5?_reload=1', original.href).href
    )
  })

  it('shows any other error with the router reset on Try again', async () => {
    let throws = true
    await open(
      setup(() => {
        if (throws) throw new Error('Something broke')
        return <p>post page</p>
      })
    )

    expect(await screen.findByText('Something broke')).toBeTruthy()
    expect(screen.getByText('sidebar')).toBeTruthy()

    throws = false
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Try again' }))
    })

    expect(await screen.findByText('post page')).toBeTruthy()
    expect(replace).not.toHaveBeenCalled()
  })
})
