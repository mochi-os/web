// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: Apache-2.0

import { describe, it, expect, afterEach } from 'vitest'
import type { RouterHistory } from '@tanstack/react-router'
import {
  getAppBasepath,
  createAppHistory,
  entityRouterPath,
  entityBrowserPath,
} from './app-path'

const FINGERPRINT = 'v9VpRumgT'
const POST = '019fe7b461987e22afdd712ac4baf1dd'

function metas(tags: Record<string, string>): void {
  document.head.innerHTML = Object.entries(tags)
    .map(([name, content]) => `<meta name="${name}" content="${content}">`)
    .join('')
}

function at(path: string): void {
  window.history.replaceState(null, '', path)
}

let history: RouterHistory | undefined

afterEach(() => {
  history?.destroy()
  history = undefined
  document.head.innerHTML = ''
  at('/')
})

// The two transforms, on their own. Base '/feed/' is a subpath route, '/' is a
// whole-domain route — both are real configurations.
describe('entity path translation', () => {
  it.each([
    ['/feed/', '/feed/', `/feed/${FINGERPRINT}`],
    ['/feed/' + POST, '/feed/', `/feed/${FINGERPRINT}/${POST}`],
    [`/feed/${FINGERPRINT}/${POST}`, '/feed/', `/feed/${FINGERPRINT}/${POST}`],
    ['/feed/settings', '/feed/', `/feed/${FINGERPRINT}/settings`],
    ['/', '/', `/${FINGERPRINT}`],
    ['/' + POST, '/', `/${FINGERPRINT}/${POST}`],
  ])('browser %s (base %s) -> router %s', (browser, base, router) => {
    expect(entityRouterPath(browser, base, FINGERPRINT)).toBe(router)
  })

  it.each([
    [`/feed/${FINGERPRINT}`, '/feed/', '/feed/'],
    [`/feed/${FINGERPRINT}/${POST}`, '/feed/', '/feed/' + POST],
    [`/feed/${FINGERPRINT}/settings`, '/feed/', '/feed/settings'],
    [`/${FINGERPRINT}/${POST}`, '/', '/' + POST],
  ])('router %s (base %s) -> browser %s', (router, base, browser) => {
    expect(entityBrowserPath(router, base, FINGERPRINT)).toBe(browser)
  })

  it('leaves paths outside the route base alone', () => {
    expect(entityRouterPath('/other/thing', '/feed/', FINGERPRINT)).toBe('/other/thing')
    expect(entityBrowserPath('/other/thing', '/feed/', FINGERPRINT)).toBe('/other/thing')
  })

  it('round-trips every browser path', () => {
    for (const path of ['/feed/', '/feed/' + POST, '/feed/settings']) {
      const router = entityRouterPath(path, '/feed/', FINGERPRINT)
      expect(entityBrowserPath(router, '/feed/', FINGERPRINT)).toBe(path)
    }
  })
})

describe('getAppBasepath', () => {
  it('uses the domain route path when the page is entity-routed', () => {
    metas({ 'mochi:app': 'feeds', 'mochi:domain': '/feed/', 'mochi:fingerprint': FINGERPRINT })
    at('/feed/')
    expect(getAppBasepath()).toBe('/feed/')
  })

  it('uses the whole-domain route path', () => {
    metas({ 'mochi:app': 'feeds', 'mochi:domain': '/', 'mochi:fingerprint': FINGERPRINT })
    at('/')
    expect(getAppBasepath()).toBe('/')
  })

  it('uses the app path on the main site', () => {
    metas({ 'mochi:app': 'feeds' })
    at('/feeds/')
    expect(getAppBasepath()).toBe('/feeds/')
  })

  it('keeps the fingerprint out of the basepath on direct entity routing', () => {
    metas({ 'mochi:app': 'feeds', 'mochi:fingerprint': FINGERPRINT })
    at(`/feeds/${FINGERPRINT}/`)
    expect(getAppBasepath()).toBe('/feeds/')
  })

  it('derives the app path from the URL in the shell, where no meta tags exist', () => {
    metas({})
    at(`/feeds/${FINGERPRINT}/?_shell=1`)
    expect(getAppBasepath()).toBe('/feeds/')
  })
})

describe('createAppHistory', () => {
  it('is not installed on the main site', () => {
    metas({ 'mochi:app': 'feeds' })
    at('/feeds/')
    expect(createAppHistory()).toBeUndefined()
  })

  it('is not installed on direct entity routing', () => {
    metas({ 'mochi:app': 'feeds', 'mochi:fingerprint': FINGERPRINT })
    at(`/feeds/${FINGERPRINT}/`)
    expect(createAppHistory()).toBeUndefined()
  })

  it('is not installed in the shell', () => {
    metas({})
    at('/feeds/?_shell=1')
    expect(createAppHistory()).toBeUndefined()
  })

  it('is not installed on an app domain route, which names no entity', () => {
    metas({ 'mochi:app': 'feeds', 'mochi:domain': '/feeds/' })
    at('/feeds/')
    expect(createAppHistory()).toBeUndefined()
  })

  it.each([
    ['/feed/', `/feed/${FINGERPRINT}`],
    ['/feed/' + POST, `/feed/${FINGERPRINT}/${POST}`],
    [`/feed/${FINGERPRINT}/${POST}`, `/feed/${FINGERPRINT}/${POST}`],
  ])('shows the router %s as %s', (browser, expected) => {
    metas({ 'mochi:app': 'feeds', 'mochi:domain': '/feed/', 'mochi:fingerprint': FINGERPRINT })
    at(browser)
    history = createAppHistory()
    expect(history?.location.pathname).toBe(expected)
  })

  it('preserves search and hash', () => {
    metas({ 'mochi:app': 'feeds', 'mochi:domain': '/feed/', 'mochi:fingerprint': FINGERPRINT })
    at(`/feed/${POST}?sort=new#comments`)
    history = createAppHistory()
    expect(history?.location.pathname).toBe(`/feed/${FINGERPRINT}/${POST}`)
    expect(history?.location.search).toBe('?sort=new')
    expect(history?.location.hash).toBe('#comments')
  })

  it('writes the short form back to the address bar', () => {
    metas({ 'mochi:app': 'feeds', 'mochi:domain': '/feed/', 'mochi:fingerprint': FINGERPRINT })
    at('/feed/')
    history = createAppHistory()
    expect(history?.createHref(`/feed/${FINGERPRINT}/${POST}`)).toBe('/feed/' + POST)
    expect(history?.createHref(`/feed/${FINGERPRINT}`)).toBe('/feed/')
    expect(history?.createHref(`/feed/${FINGERPRINT}/${POST}?sort=new`)).toBe(
      '/feed/' + POST + '?sort=new'
    )
  })
})
