// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: Apache-2.0
import { describe, expect, it } from 'vitest'
import { chatSharePath, feedSharePath, shareMessage, shareRead } from './share'

describe('share addresses', () => {
  it("open Feeds' and Chat's share addresses with the words and the link", () => {
    const share = {
      text: 'Launch party\nFriday & after',
      url: 'https://example.org/launch?x=1',
    }
    for (const [path, base] of [
      [feedSharePath(share), '/feeds/share'],
      [chatSharePath(share), '/chat/share'],
    ]) {
      const url = new URL(path, 'http://x.invalid')
      expect(url.pathname).toBe(base)
      expect(url.searchParams.get('text')).toBe('Launch party\nFriday & after')
      expect(url.searchParams.get('url')).toBe('https://example.org/launch?x=1')
    }
  })

  it('leave out what there is none of', () => {
    expect(feedSharePath({ text: 'Hello' })).toBe('/feeds/share?text=Hello')
    expect(chatSharePath({ text: '' })).toBe('/chat/share')
  })
})

describe('shareRead', () => {
  it('reads back what was shared', () => {
    const path = chatSharePath({ text: 'A & B', url: 'https://e.org/' })
    expect(shareRead(path.slice(path.indexOf('?')))).toEqual({
      text: 'A & B',
      url: 'https://e.org/',
    })
  })

  it('reads nothing as nothing', () => {
    expect(shareRead('')).toEqual({ text: '', url: '' })
  })
})

describe('shareMessage', () => {
  it('puts the address a blank line after the words', () => {
    expect(shareMessage({ text: 'Stand-up ', url: 'https://e.org/x' })).toBe(
      'Stand-up\n\nhttps://e.org/x'
    )
  })

  it('does not repeat an address the words already hold', () => {
    expect(
      shareMessage({ text: 'See https://e.org/x', url: 'https://e.org/x' })
    ).toBe('See https://e.org/x')
  })

  it('is the address alone, or the words alone, where there is only one', () => {
    expect(shareMessage({ text: '', url: 'https://e.org/x' })).toBe(
      'https://e.org/x'
    )
    expect(shareMessage({ text: 'Hello' })).toBe('Hello')
  })
})
