// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: Apache-2.0

// The comments slot: the lightbox owns the chrome (button, count, panel
// placement, the auto-hide hold) and renders whatever the app hands it for
// the current image, and nothing else. What is asserted is that contract —
// not what a comment looks like, which is each app's business.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import { I18nProvider } from '@lingui/react'
import { i18n } from '@lingui/core'
import { ImageLightbox, type LightboxMedia } from './image-lightbox'

// Shell storage is a postMessage proxy to the parent shell; here it is an
// in-memory map so the remembered-panel behaviour can be asserted.
const shellStore = new Map<string, string>()
vi.mock('../../lib/shell-storage', () => ({
  getItem: vi.fn(async (key: string) => shellStore.get(key) ?? null),
  setItem: vi.fn(async (key: string, value: string) => {
    shellStore.set(key, value)
  }),
  removeItem: vi.fn(async (key: string) => {
    shellStore.delete(key)
  }),
}))

const media: LightboxMedia[] = [
  { id: 'a', name: 'a.png', url: 'blob:a', type: 'image' },
  { id: 'b', name: 'b.png', url: 'blob:b', type: 'image', caption: 'The harbour' },
]

function show(props: Partial<React.ComponentProps<typeof ImageLightbox>> = {}) {
  const onIndexChange = vi.fn()
  const utils = render(
    <I18nProvider i18n={i18n}>
      <ImageLightbox
        images={media}
        currentIndex={0}
        open
        onOpenChange={() => {}}
        onIndexChange={onIndexChange}
        {...props}
      />
    </I18nProvider>
  )
  return { ...utils, onIndexChange }
}

beforeEach(() => {
  // jsdom has no fullscreen; the lightbox swallows the refusal but must not
  // throw on a missing function either.
  Object.defineProperty(document.documentElement, 'requestFullscreen', {
    configurable: true,
    value: undefined,
  })
  // The zoom/pan wrapper observes its element's size; jsdom has no
  // ResizeObserver, and none of these tests measure anything.
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    }
  )
})

afterEach(() => {
  vi.unstubAllGlobals()
  shellStore.clear()
})

afterEach(() => {
  vi.useRealTimers()
})

describe('ImageLightbox comments slot', () => {
  it('draws no comment button unless the slot is supplied', () => {
    show()
    expect(screen.queryByRole('button', { name: 'Comments' })).toBeNull()
  })

  it('draws the button with the current image count, and toggles the panel', () => {
    const renderComments = vi.fn((id: string) => <div>thread for {id}</div>)
    show({
      renderComments,
      commentCount: (id) => (id === 'a' ? 3 : 0),
    })
    const button = screen.getByRole('button', { name: 'Comments' })
    expect(button).toHaveTextContent('3')
    expect(screen.queryByText('thread for a')).toBeNull()

    fireEvent.click(button)
    expect(screen.getByText('thread for a')).toBeInTheDocument()
    expect(renderComments).toHaveBeenCalledWith('a')

    fireEvent.click(button)
    expect(screen.queryByText('thread for a')).toBeNull()
  })

  it('leaves the count off when the image has none', () => {
    show({ renderComments: () => null, commentCount: () => 0 })
    expect(screen.getByRole('button', { name: 'Comments' })).not.toHaveTextContent('0')
  })

  // The panel follows the image: the slot is asked for the current media id.
  it('re-renders the panel for the image now showing', () => {
    const renderComments = vi.fn((id: string) => <div>thread for {id}</div>)
    const { rerender } = show({ renderComments, commentsInitiallyOpen: true })
    expect(screen.getByText('thread for a')).toBeInTheDocument()

    rerender(
      <I18nProvider i18n={i18n}>
        <ImageLightbox
          images={media}
          currentIndex={1}
          open
          onOpenChange={() => {}}
          onIndexChange={() => {}}
          renderComments={renderComments}
          commentsInitiallyOpen
        />
      </I18nProvider>
    )
    expect(screen.getByText('thread for b')).toBeInTheDocument()
    expect(screen.queryByText('thread for a')).toBeNull()
  })

  it('opens with the panel showing when asked to (a comment chip was clicked)', () => {
    show({ renderComments: () => <div>anchored thread</div>, commentsInitiallyOpen: true })
    expect(screen.getByText('anchored thread')).toBeInTheDocument()
  })

  // The panel starts the way the user last left it - a preference, not a
  // function of whether the image has comments.
  describe('remembered panel preference', () => {
    it('starts closed by default and remembers a toggle open', async () => {
      show({ renderComments: () => <div>thread</div> })
      expect(screen.queryByText('thread')).toBeNull()
      fireEvent.click(screen.getByRole('button', { name: 'Comments' }))
      expect(screen.getByText('thread')).toBeInTheDocument()
      await vi.waitFor(() => expect(shellStore.get('lightbox.comments')).toBe('true'))
    })

    it('opens with the panel showing when the preference says so', async () => {
      shellStore.set('lightbox.comments', 'true')
      const { rerender } = render(
        <I18nProvider i18n={i18n}>
          <ImageLightbox images={media} currentIndex={0} open={false} onOpenChange={() => {}} onIndexChange={() => {}} renderComments={() => <div>thread</div>} />
        </I18nProvider>
      )
      // Let the async read land while closed, then open.
      await vi.waitFor(() => expect(shellStore.get('lightbox.comments')).toBe('true'))
      await new Promise((resolve) => setTimeout(resolve, 0))
      rerender(
        <I18nProvider i18n={i18n}>
          <ImageLightbox images={media} currentIndex={0} open onOpenChange={() => {}} onIndexChange={() => {}} renderComments={() => <div>thread</div>} />
        </I18nProvider>
      )
      expect(screen.getByText('thread')).toBeInTheDocument()
    })

    it('does not move the preference when a comment chip opened the panel', async () => {
      show({ renderComments: () => <div>thread</div>, commentsInitiallyOpen: true })
      expect(screen.getByText('thread')).toBeInTheDocument()
      await new Promise((resolve) => setTimeout(resolve, 0))
      expect(shellStore.has('lightbox.comments')).toBe(false)
    })
  })

  // The chrome auto-hides after a delay; a viewer reading or writing in the
  // panel must not have it vanish under them.
  it('holds the chrome while the panel is open', () => {
    vi.useFakeTimers()
    show({ renderComments: () => <div>thread</div> })
    const bar = () => screen.getByRole('button', { name: 'Comments' }).closest('div[class*="absolute"]')!

    // Closed panel: the chrome fades after the delay.
    act(() => {
      vi.advanceTimersByTime(3500)
    })
    expect(bar().className).toContain('opacity-0')

    // Open the panel: chrome comes back and stays past the delay.
    act(() => {
      fireEvent.click(screen.getByRole('button', { name: 'Comments' }))
    })
    expect(bar().className).toContain('opacity-100')
    act(() => {
      vi.advanceTimersByTime(10000)
    })
    expect(bar().className).toContain('opacity-100')
  })
})
