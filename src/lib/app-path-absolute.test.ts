// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: Apache-2.0

import { describe, it, expect } from 'vitest'
import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
} from '@tanstack/react-router'
import { absoluteRouteUrl } from './app-path'

function routerWith(basepath: string, history = createMemoryHistory()) {
  const root = createRootRoute()
  const item = createRoute({
    getParentRoute: () => root,
    path: '/$crmId/$objectId',
  })
  return createRouter({
    routeTree: root.addChildren([item]),
    basepath,
    history,
  })
}

describe('absoluteRouteUrl', () => {
  it('builds the full address under the app base path', () => {
    const url = absoluteRouteUrl(routerWith('/crm/'), {
      to: '/$crmId/$objectId',
      params: { crmId: 'fp123', objectId: 'obj9' },
    })
    expect(url).toBe(`${window.location.origin}/crm/fp123/obj9`)
  })

  it('lets the history shorten the path, as a domain route does', () => {
    const history = createMemoryHistory()
    history.createHref = (href: string) => href.replace('/fp123', '')
    const url = absoluteRouteUrl(routerWith('/crm/', history), {
      to: '/$crmId/$objectId',
      params: { crmId: 'fp123', objectId: 'obj9' },
    })
    expect(url).toBe(`${window.location.origin}/crm/obj9`)
  })
})
