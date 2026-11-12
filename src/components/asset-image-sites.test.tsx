// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: Apache-2.0

import type { ReactElement } from 'react'
import { act, render } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// Every shared component that shows an image of the app's own takes its bytes
// through the shell in the frame (see lib/shell-image.ts), as a plain <img>
// would fetch them uncached on every page view.
let posted: Array<Record<string, unknown>>

beforeEach(() => {
  posted = []
  const parent = {
    postMessage: (message: unknown) => {
      posted.push(message as Record<string, unknown>)
    },
    get document(): never {
      throw new DOMException('Blocked', 'SecurityError')
    },
  }
  Object.defineProperty(window, 'parent', {
    configurable: true,
    get() {
      return parent
    },
  })
  window.history.replaceState({}, '', '/feeds/abc')
  URL.createObjectURL = vi.fn(() => 'blob:mochi/image')
  URL.revokeObjectURL = vi.fn()
  // Lazy tiles fetch once near the screen; here everything is.
  vi.stubGlobal(
    'IntersectionObserver',
    class {
      callback: (records: Array<{ isIntersecting: boolean }>) => void
      constructor(
        callback: (records: Array<{ isIntersecting: boolean }>) => void
      ) {
        this.callback = callback
      }
      observe() {
        this.callback([{ isIntersecting: true }])
      }
      disconnect() {}
    }
  )
})

afterEach(() => {
  Object.defineProperty(window, 'parent', {
    configurable: true,
    get() {
      return window
    },
  })
  window.history.replaceState({}, '', '/')
  vi.unstubAllGlobals()
  vi.resetModules()
})

function fromParent(data: unknown) {
  const event = new MessageEvent('message', {
    data,
    origin: window.location.origin,
  })
  Object.defineProperty(event, 'source', {
    value: window.parent,
    configurable: true,
  })
  window.dispatchEvent(event)
}

const IMAGE = '/feeds/abc/-/attachments/x/thumbnail'

async function boot() {
  const bridge = await import('../lib/shell-bridge')
  const init = bridge.initShellBridge()
  fromParent({
    type: 'init',
    token: 'app-token',
    asset: 'asset-token',
    inShell: true,
    fetch: true,
  })
  await init
}

// Renders the element, answers the shell's fetch for the image, and returns
// what the element's <img> elements then show.
async function shown(element: () => Promise<ReactElement>) {
  await boot()
  // Fresh modules after resetModules, so the provider is the one the
  // component imports.
  const { i18n } = await import('@lingui/core')
  const { I18nProvider } = await import('@lingui/react')
  i18n.loadAndActivate({ locale: 'en', messages: {} })
  render(<I18nProvider i18n={i18n}>{await element()}</I18nProvider>)
  await vi.waitFor(() =>
    expect(posted.filter((message) => message.type === 'fetch')).toHaveLength(1)
  )
  const request = posted.find((message) => message.type === 'fetch')!
  expect(request.url).toBe(window.location.origin + IMAGE)
  await act(async () => {
    fromParent({
      type: 'fetch.result',
      id: request.id,
      status: 200,
      headers: [['content-type', 'image/png']],
      body: new Uint8Array([137, 80, 78, 71]).buffer,
    })
  })
  return [...document.querySelectorAll('img')].map((image) =>
    image.getAttribute('src')
  )
}

describe('shared components show their images through the shell', () => {
  // Chrome outlines a sized <img> that has no src. Hidden until the bytes
  // arrive, a tile shows its own background instead of a grey frame.
  it('hides the image until its bytes arrive', async () => {
    await boot()
    const { AssetImage } = await import('./asset-image')
    render(<AssetImage src={IMAGE} alt='' />)
    const image = document.querySelector('img')!
    expect(image.style.visibility).toBe('hidden')
    await vi.waitFor(() =>
      expect(posted.filter((message) => message.type === 'fetch')).toHaveLength(
        1
      )
    )
    const request = posted.find((message) => message.type === 'fetch')!
    await act(async () => {
      fromParent({
        type: 'fetch.result',
        id: request.id,
        status: 200,
        headers: [['content-type', 'image/png']],
        body: new Uint8Array([137, 80, 78, 71]).buffer,
      })
    })
    expect(image.getAttribute('src')).toBe('blob:mochi/image')
    expect(image.style.visibility).toBe('')
  })

  it('an attachment tile in a gallery', async () => {
    const sources = await shown(async () => {
      const { AttachmentImage } = await import('./attachment-image')
      return <AttachmentImage src={IMAGE + '?token=asset'} alt='' />
    })
    expect(sources).toEqual(['blob:mochi/image'])
  })

  it('a staged attachment in the composer', async () => {
    const sources = await shown(async () => {
      const { AttachmentComposer } = await import('./attachment-composer')
      return (
        <AttachmentComposer
          items={[
            {
              key: 'x',
              name: 'photo.png',
              size: 4,
              type: 'image/png',
              previewUrl: IMAGE + '?token=asset',
            },
          ]}
        />
      )
    })
    expect(sources).toContain('blob:mochi/image')
    expect(sources.every((source) => source === 'blob:mochi/image')).toBe(true)
  })

  it('an attachment tile, its backdrop included', async () => {
    const sources = await shown(async () => {
      const { AttachmentTile } = await import('./ui/attachment')
      return <AttachmentTile name='photo.png' previewUrl={IMAGE} />
    })
    expect(sources).toEqual(['blob:mochi/image', 'blob:mochi/image'])
  })

  it('a quoted post', async () => {
    const sources = await shown(async () => {
      const { QuoteCard } = await import('./quote-card')
      return (
        <QuoteCard
          quote={{
            network: 'mochi',
            url: window.location.origin + '/feeds/abc',
            image: window.location.origin + IMAGE,
          }}
        />
      )
    })
    expect(sources).toContain('blob:mochi/image')
  })

  it('an entity banner', async () => {
    const sources = await shown(async () => {
      const { EntityBanner } = await import('./entity-banner')
      return <EntityBanner src={IMAGE} alt='' />
    })
    expect(sources).toEqual(['blob:mochi/image'])
  })

  it('the lightbox', async () => {
    const sources = await shown(async () => {
      const { ImageLightbox } = await import('./ui/image-lightbox')
      return (
        <ImageLightbox
          images={[{ id: 'x', name: 'photo.png', url: IMAGE, type: 'image' }]}
          currentIndex={0}
          open
          onOpenChange={() => {}}
          onIndexChange={() => {}}
        />
      )
    })
    expect(sources).toContain('blob:mochi/image')
  })
})
