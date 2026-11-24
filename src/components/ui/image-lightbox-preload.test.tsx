// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: Apache-2.0

// The lightbox loads the images beside the one shown ahead of time, except in
// the shell's frame: its opaque origin caches nothing, and each address there
// carries the asset token.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render } from '@testing-library/react'
import { I18nProvider } from '@lingui/react'
import { i18n } from '@lingui/core'
import { ImageLightbox, type LightboxMedia } from './image-lightbox'

let framed = false
vi.mock('../../lib/shell-bridge', async (original) => ({
  ...(await original<typeof import('../../lib/shell-bridge')>()),
  isInShell: () => framed,
}))

vi.mock('../../lib/shell-storage', () => ({
  getItem: vi.fn(async () => null),
  readItem: vi.fn(async () => null),
  setItem: vi.fn(async () => {}),
  removeItem: vi.fn(async () => {}),
}))

const media: LightboxMedia[] = ['a', 'b', 'c'].map((id) => ({
  id,
  name: `${id}.png`,
  url: `/feeds/x/-/attachments/${id}?token=asset-token`,
  type: 'image',
}))

let preloaded: string[]

beforeEach(() => {
  preloaded = []
  vi.stubGlobal(
    'Image',
    class {
      set src(value: string) {
        preloaded.push(value)
      }
    }
  )
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    }
  )
  Object.defineProperty(document.documentElement, 'requestFullscreen', {
    configurable: true,
    value: undefined,
  })
})

afterEach(() => {
  vi.unstubAllGlobals()
  framed = false
})

function show() {
  render(
    <I18nProvider i18n={i18n}>
      <ImageLightbox
        images={media}
        currentIndex={1}
        open
        onOpenChange={() => {}}
        onIndexChange={() => {}}
      />
    </I18nProvider>
  )
}

describe('lightbox preloading', () => {
  it('loads the neighbouring images ahead of time in a page of its own', () => {
    show()
    expect(preloaded.sort()).toEqual([media[0].url, media[2].url])
  })

  it("loads none ahead of time in the shell's frame", () => {
    framed = true
    show()
    expect(preloaded).toEqual([])
  })
})
