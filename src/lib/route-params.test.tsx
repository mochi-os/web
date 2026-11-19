// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: Apache-2.0

import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  isNotFound,
  Outlet,
  RouterProvider,
} from '@tanstack/react-router'
import { guardParams, paramShapes } from './route-params'

const ENTITY = '1sfEACmTnQhBVgquGhaCs8Jw4SXKF9XY2apnUwJ63duq2QSxh5'
const ID = '0193a1b2c3d4e5f60718293a4b5c6d7e'

function thrown(run: () => unknown): unknown {
  try {
    run()
  } catch (error) {
    return error
  }
  return undefined
}

describe('paramShapes', () => {
  it('takes an entity id, as core does', () => {
    expect(paramShapes.entity.test(ENTITY)).toBe(true)
    expect(paramShapes.entity.test(ENTITY.slice(0, 48))).toBe(false)
    expect(paramShapes.entity.test(`${ENTITY}/-/delete`)).toBe(false)
  })

  it('takes a fingerprint with or without its hyphens', () => {
    expect(paramShapes.fingerprint.test('va7kZSfKM')).toBe(true)
    expect(paramShapes.fingerprint.test('va7-kZS-fKM')).toBe(true)
    expect(paramShapes.fingerprint.test('va7kZSfK')).toBe(false)
    expect(paramShapes.fingerprint.test('va7-kZSfKM')).toBe(false)
    expect(paramShapes.fingerprint.test('va7kZSfKM\n')).toBe(false)
  })

  it('takes a row id, as core does', () => {
    expect(paramShapes.id.test(ID)).toBe(true)
    expect(paramShapes.id.test(ID.toUpperCase())).toBe(false)
    expect(paramShapes.id.test(`${ID}x`)).toBe(false)
  })
})

describe('guardParams', () => {
  const feed = guardParams({
    feedId: [paramShapes.entity, paramShapes.fingerprint],
  })

  it('returns the parameters when each fits', () => {
    const params = { feedId: ENTITY, postId: 'anything' }
    expect(feed(params)).toBe(params)
    expect(feed({ feedId: 'va7kZSfKM' })).toEqual({ feedId: 'va7kZSfKM' })
  })

  it.each([
    ['a decoded backslash climb', `${ENTITY}\\-\\delete?x=`],
    ['a decoded slash', `${ENTITY}/-/delete`],
    ['a protocol-relative host', '//attacker.example'],
    ['empty', ''],
    ['two dots', '..'],
  ])('throws not-found for %s', (_name, feedId) => {
    expect(isNotFound(thrown(() => feed({ feedId })))).toBe(true)
  })

  it('takes a predicate', () => {
    const even = guardParams({ n: (value: string) => Number(value) % 2 === 0 })
    expect(even({ n: '2' })).toEqual({ n: '2' })
    expect(isNotFound(thrown(() => even({ n: '3' })))).toBe(true)
  })

  it('renders not-found and runs no loader for a parameter that does not fit', async () => {
    const loader = vi.fn((_feedId: string) => null)
    const root = createRootRoute({ component: Outlet })
    const route = createRoute({
      getParentRoute: () => root,
      path: '$feedId',
      params: { parse: feed },
      loader: ({ params }) => loader(params.feedId),
      component: function Feed() {
        return <p>feed {route.useParams().feedId}</p>
      },
      notFoundComponent: () => <p>not found</p>,
    })
    const router = (path: string) =>
      createRouter({
        routeTree: root.addChildren([route]),
        history: createMemoryHistory({ initialEntries: [path] }),
      })

    const hostile = render(
      <RouterProvider router={router(`/${ENTITY}%5C-%5Cdelete%3Fx%3D`)} />
    )
    expect(await screen.findByText('not found')).toBeTruthy()
    expect(loader).not.toHaveBeenCalled()
    hostile.unmount()

    // Positive control: the same route loads a feed it is given.
    render(<RouterProvider router={router(`/${ENTITY}`)} />)
    expect(await screen.findByText(`feed ${ENTITY}`)).toBeTruthy()
    expect(loader).toHaveBeenCalledWith(ENTITY)
  })
})
