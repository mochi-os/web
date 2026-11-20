// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: Apache-2.0
import { afterEach, describe, expect, it } from 'vitest'
import { localPath, networkSetupPath, pagePath } from './network-setup'

describe('localPath', () => {
  it('keeps a path on this server with its query', () => {
    expect(localPath('/feeds/abc/settings?tab=publish')).toBe(
      '/feeds/abc/settings?tab=publish'
    )
  })

  it('refuses anything that leaves the server', () => {
    for (const value of [
      '//evil.example/x',
      '/\\evil.example/x',
      '/\t/evil.example/x',
      'https://evil.example/',
      'javascript:alert(1)',
      'feeds',
      '',
      null,
      undefined,
    ]) {
      expect(localPath(value)).toBeNull()
    }
  })
})

describe('networkSetupPath', () => {
  it('opens Settings › Networks at the network, coming back to the page', () => {
    const path = networkSetupPath('bluesky', '/feeds/abc/settings?tab=publish')
    const url = new URL(path, 'http://x.invalid')
    expect(url.pathname).toBe('/settings/user/networks')
    expect(url.searchParams.get('network')).toBe('bluesky')
    expect(url.searchParams.get('back')).toBe('/feeds/abc/settings?tab=publish')
  })

  it('leaves out a way back that would leave the server', () => {
    const url = new URL(
      networkSetupPath('xmpp', '//evil.example/'),
      'http://x.invalid'
    )
    expect(url.searchParams.get('network')).toBe('xmpp')
    expect(url.searchParams.has('back')).toBe(false)
  })
})

describe('pagePath', () => {
  const before = window.location.href
  afterEach(() => window.history.replaceState(null, '', before))

  it('drops the shell markers and keeps the rest', () => {
    window.history.replaceState(
      null,
      '',
      '/feeds/abc/settings?_shell=1&tab=publish&_reload=1'
    )
    expect(pagePath()).toBe('/feeds/abc/settings?tab=publish')
  })
})
