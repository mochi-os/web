// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: Apache-2.0

import { describe, it, expect } from 'vitest'
import { isSameOriginRequest, getSafeNavigationTarget } from './safe-navigation'

// jsdom serves the suite from http://localhost:3000 by default; assert it so a
// change of test origin can't make these cases pass for the wrong reason.
const ORIGIN = window.location.origin

describe('isSameOriginRequest', () => {
  it('runs against a known origin', () => {
    expect(ORIGIN).toMatch(/^https?:\/\//)
  })

  it('attaches to a relative URL under an app baseURL', () => {
    expect(isSameOriginRequest('/feeds/', 'abc/-/info')).toBe(true)
  })

  it('attaches to a root-relative URL with no baseURL', () => {
    expect(isSameOriginRequest('', '/_/identity')).toBe(true)
    expect(isSameOriginRequest(undefined, '/_/token')).toBe(true)
  })

  it('attaches to an absolute same-origin URL', () => {
    // search-entity-page builds these deliberately, to bypass an
    // entity-context baseURL. They must keep their token.
    expect(isSameOriginRequest('/forums/x/-/', `${ORIGIN}/forums/directory`)).toBe(true)
  })

  it('refuses an absolute foreign URL', () => {
    expect(isSameOriginRequest('/feeds/', 'https://attacker.example/')).toBe(false)
    expect(isSameOriginRequest('', 'http://attacker.example/x')).toBe(false)
  })

  it('refuses a protocol-relative URL, which axios treats as absolute', () => {
    expect(isSameOriginRequest('/feeds/', '//attacker.example/-/info')).toBe(false)
    expect(isSameOriginRequest('', '//attacker.example/-/info')).toBe(false)
  })

  it('refuses a route parameter that decoded to a protocol-relative host', () => {
    // The live vector: /feeds/%2F%2Fattacker.example decodes to
    // "//attacker.example", which lands in the first slot of a relative
    // endpoint builder.
    const feedId = decodeURIComponent('%2F%2Fattacker.example')
    expect(feedId).toBe('//attacker.example')
    expect(isSameOriginRequest('/feeds/', `${feedId}/-/info`)).toBe(false)
  })

  it('refuses a scheme-bearing URL that axios leaves absolute', () => {
    // "mochi://..." carries "//", so axios drops the baseURL and the request
    // leaves our origin.
    expect(isSameOriginRequest('/feeds/', 'mochi://peer/entity')).toBe(false)
    expect(isSameOriginRequest('', 'javascript:alert(1)')).toBe(false)
  })

  it('attaches when a scheme-like string is combined into a same-origin path', () => {
    // Deliberate, and matches axios: without "//", "javascript:alert(1)" is
    // relative, so buildFullPath yields "/feeds/javascript:alert(1)" — a real
    // request to our own server. It 404s; it does not leave the origin.
    expect(isSameOriginRequest('/feeds/', 'javascript:alert(1)')).toBe(true)
  })

  it('refuses a URL whose host differs only by port', () => {
    const other = ORIGIN.replace(/:\d+$/, '') + ':4433'
    expect(isSameOriginRequest('', `${other}/status`)).toBe(false)
  })

  it('does not double a slash when baseURL and URL both carry one', () => {
    expect(isSameOriginRequest('/feeds/', '/abc/-/info')).toBe(true)
  })

  it('treats an unparseable URL as foreign', () => {
    expect(isSameOriginRequest('http://[', 'x')).toBe(false)
  })
})

describe('getSafeNavigationTarget', () => {
  it('returns a path for a same-origin target', () => {
    expect(getSafeNavigationTarget('/feeds/abc', ORIGIN)).toBe('/feeds/abc')
    expect(getSafeNavigationTarget(`${ORIGIN}/feeds/abc?x=1#y`, ORIGIN)).toBe('/feeds/abc?x=1#y')
  })

  it('rejects empty and blank targets', () => {
    expect(getSafeNavigationTarget('', ORIGIN)).toBeNull()
    expect(getSafeNavigationTarget('   ', ORIGIN)).toBeNull()
    expect(getSafeNavigationTarget(null, ORIGIN)).toBeNull()
    expect(getSafeNavigationTarget(undefined, ORIGIN)).toBeNull()
  })

  it('rejects an unsafe scheme', () => {
    expect(getSafeNavigationTarget('javascript:alert(1)', ORIGIN)).toBeNull()
    expect(getSafeNavigationTarget('  javascript:alert(1)  ', ORIGIN)).toBeNull()
    expect(getSafeNavigationTarget('data:text/html,<script>', ORIGIN)).toBeNull()
  })

  it('rejects an untrusted external host', () => {
    expect(getSafeNavigationTarget('https://attacker.example/x', ORIGIN)).toBeNull()
    expect(getSafeNavigationTarget('//attacker.example/x', ORIGIN)).toBeNull()
  })

  it('allows a trusted external host over https only', () => {
    const options = { trustedExternalHosts: ['checkout.stripe.com'] }
    expect(getSafeNavigationTarget('https://checkout.stripe.com/pay', ORIGIN, options)).toBe(
      'https://checkout.stripe.com/pay'
    )
    expect(getSafeNavigationTarget('http://checkout.stripe.com/pay', ORIGIN, options)).toBeNull()
  })

  it('matches a wildcard trusted host on its own domain and subdomains', () => {
    const options = { trustedExternalHosts: ['*.stripe.com'] }
    expect(getSafeNavigationTarget('https://stripe.com/x', ORIGIN, options)).not.toBeNull()
    expect(getSafeNavigationTarget('https://checkout.stripe.com/x', ORIGIN, options)).not.toBeNull()
    // Suffix matching must not admit a lookalike registrable domain.
    expect(getSafeNavigationTarget('https://evilstripe.com/x', ORIGIN, options)).toBeNull()
  })
})
