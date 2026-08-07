// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: Apache-2.0

// The properties under test are the ones the apps rely on being independent:
// layout, preview and reordering are three separate switches, and a send in
// flight freezes the list it is uploading.

import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { I18nProvider } from '@lingui/react'
import { i18n } from '@lingui/core'
import { AttachmentComposer, type ComposerItem } from './attachment-composer'

function item(name: string, extra: Partial<ComposerItem> = {}): ComposerItem {
  return { key: name, name, size: 1024, type: 'image/png', ...extra }
}

function show(props: Partial<React.ComponentProps<typeof AttachmentComposer>> = {}) {
  return render(
    <I18nProvider i18n={i18n}>
      <AttachmentComposer items={[item('a.png'), item('b.png')]} {...props} />
    </I18nProvider>
  )
}

describe('AttachmentComposer', () => {
  it('renders nothing when there is nothing staged', () => {
    const { container } = show({ items: [] })
    expect(container).toBeEmptyDOMElement()
  })

  it('defaults to the scrolling row of inline chips', () => {
    show()
    expect(document.querySelector('[data-slot=attachment-group]')).toHaveAttribute(
      'data-layout',
      'row'
    )
    expect(document.querySelectorAll('[data-slot=attachment]')).toHaveLength(2)
    expect(document.querySelectorAll('[data-slot=attachment-tile]')).toHaveLength(0)
  })

  // The three switches are independent on purpose: a chat box can want a
  // wrapping grid of small chips, which the old "onReorder implies everything"
  // shape could not express.
  it('takes layout and preview separately', () => {
    show({ layout: 'grid', preview: 'inline' })
    expect(document.querySelector('[data-slot=attachment-group]')).toHaveAttribute(
      'data-layout',
      'grid'
    )
    expect(document.querySelectorAll('[data-slot=attachment]')).toHaveLength(2)
  })

  it('renders square tiles when asked for them', () => {
    show({ preview: 'tile' })
    expect(document.querySelectorAll('[data-slot=attachment-tile]')).toHaveLength(2)
    expect(screen.getByText('a.png')).toBeInTheDocument()
  })

  it('reports the index of the attachment being removed', () => {
    const onRemove = vi.fn()
    show({ onRemove })

    fireEvent.click(screen.getAllByRole('button', { name: 'Remove' })[1])

    expect(onRemove).toHaveBeenCalledWith(1)
  })

  it('shows the formatted size, or whatever the caller put in its place', () => {
    show({ items: [item('a.png'), item('big.png', { meta: 'Too large' })] })
    expect(screen.getByText('Too large')).toBeInTheDocument()
    expect(screen.getByText('1.0 KB')).toBeInTheDocument()
  })

  // Removing a file mid-upload would leave the request sending something the
  // list no longer shows.
  it('withdraws the remove buttons while a send is in flight', () => {
    show({ onRemove: vi.fn(), state: 'uploading' })
    expect(screen.queryAllByRole('button', { name: 'Remove' })).toHaveLength(0)
  })

  it('offers a retry only after a failed send', () => {
    const onRetry = vi.fn()
    show({ onRetry })
    expect(screen.queryByRole('button', { name: /retry/i })).not.toBeInTheDocument()

    show({ onRetry, state: 'error' })
    fireEvent.click(screen.getByRole('button', { name: /retry/i }))
    expect(onRetry).toHaveBeenCalled()
  })

  // Per-file progress: the fill is decorative, so what is asserted is the
  // width it draws and the byte line beside it, not an aria value.
  describe('per-file progress', () => {
    const fill = () =>
      document.querySelector('[data-slot=attachment-progress] > div') as HTMLElement

    it('draws nothing until a slice arrives', () => {
      show({ preview: 'tile' })
      expect(document.querySelector('[data-slot=attachment-progress]')).toBeNull()
    })

    it('fills each tile by its own share', () => {
      show({
        preview: 'tile',
        items: [
          item('a.png', { progress: { fraction: 1, state: 'sent' } }),
          item('b.png', { progress: { fraction: 0.25, state: 'uploading' } }),
        ],
      })
      const fills = document.querySelectorAll<HTMLElement>(
        '[data-slot=attachment-progress] > div'
      )
      expect(fills).toHaveLength(2)
      expect(fills[0].style.width).toBe('100%')
      expect(fills[1].style.width).toBe('25%')
    })

    // 1024 bytes at a quarter sent, formatted the same way the aggregate bar
    // formats it, so the two lines in the same view agree.
    it('swaps the size line for byte counts on the file in flight', () => {
      show({
        preview: 'tile',
        items: [item('a.png', { progress: { fraction: 0.25, state: 'uploading' } })],
      })
      expect(screen.getByText('256 B of 1.0 KB')).toBeInTheDocument()
    })

    it('leaves the plain size on queued and finished files', () => {
      show({
        preview: 'tile',
        items: [
          item('a.png', { progress: { fraction: 0, state: 'waiting' } }),
          item('b.png', { progress: { fraction: 1, state: 'sent' } }),
        ],
      })
      expect(screen.getAllByText('1.0 KB')).toHaveLength(2)
    })

    it('replaces the indeterminate pulse once there is a real fraction', () => {
      show({
        preview: 'tile',
        state: 'uploading',
        items: [item('a.png', { progress: { fraction: 0.5, state: 'uploading' } })],
      })
      expect(screen.getByText('a.png')).not.toHaveClass('animate-pulse')
      expect(fill().style.width).toBe('50%')
    })

    it('fills inline chips too', () => {
      show({
        preview: 'inline',
        items: [item('a.png', { progress: { fraction: 0.4, state: 'uploading' } })],
      })
      expect(fill().style.width).toBe('40%')
    })
  })

  it('drags an attachment to a new position', () => {
    const onReorder = vi.fn()
    // jsdom does no layout, so the two tiles are given rectangles to sit in.
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(
      function (this: HTMLElement) {
        const slot = this.getAttribute('data-slot')
        if (slot !== 'attachment-tile') {
          return { left: 0, top: 0, right: 260, bottom: 100 } as DOMRect
        }
        const first = this.textContent?.startsWith('a.png')
        return first
          ? ({ left: 0, top: 0, right: 100, bottom: 100 } as DOMRect)
          : ({ left: 160, top: 0, right: 260, bottom: 100 } as DOMRect)
      }
    )
    const frames: FrameRequestCallback[] = []
    vi.stubGlobal('requestAnimationFrame', (f: FrameRequestCallback) => frames.push(f))
    vi.stubGlobal('cancelAnimationFrame', () => {})

    show({ preview: 'tile', onReorder })
    const first = screen.getByText('a.png').closest('[data-slot=attachment-tile]')!
    fireEvent.pointerDown(first, { pointerId: 1, pointerType: 'mouse', button: 0, clientX: 50, clientY: 50 })
    fireEvent.pointerMove(window, { pointerId: 1, pointerType: 'mouse', clientX: 60, clientY: 50 })
    fireEvent.pointerMove(window, { pointerId: 1, pointerType: 'mouse', clientX: 210, clientY: 50 })
    frames.splice(0).forEach((f) => f(0))

    expect(onReorder).toHaveBeenCalledWith(0, 1)

    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  it('freezes the order while a send is in flight', () => {
    const onReorder = vi.fn()
    show({ preview: 'tile', onReorder, state: 'uploading' })
    const first = screen.getByText('a.png').closest('[data-slot=attachment-tile]')!

    fireEvent.pointerDown(first, { pointerId: 1, pointerType: 'mouse', button: 0, clientX: 50, clientY: 50 })
    fireEvent.pointerMove(window, { pointerId: 1, pointerType: 'mouse', clientX: 210, clientY: 50 })

    expect(onReorder).not.toHaveBeenCalled()
  })
})
