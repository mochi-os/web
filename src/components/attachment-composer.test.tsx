// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: Apache-2.0

// The properties under test are the ones the apps rely on being independent:
// layout, preview and reordering are three separate switches, and a send in
// flight freezes the list it is uploading.

import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { I18nProvider } from '@lingui/react'
import { i18n } from '@lingui/core'
import { AttachmentComposer, type ComposerItem } from './attachment-composer'

/** A tile leads with its position chip, so the name is the paragraph's. */
function tileName(tile: HTMLElement) {
  return tile.querySelector('p')?.textContent
}

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

  // An <img> renders nothing for a video source, so a staged clip needs the
  // caller to say which element to draw. It used to get neither the URL nor the
  // kind and fell through to an icon.
  describe('video previews', () => {
    const clip = (name: string) =>
      item(name, { type: 'video/mp4', previewUrl: `blob:${name}`, previewKind: 'video' as const })

    it('draws a video element for a staged clip', () => {
      show({ preview: 'tile', items: [clip('clip.mp4')] })
      const video = document.querySelector('video')
      expect(video).toHaveAttribute('src', 'blob:clip.mp4')
      expect(document.querySelector('img')).toBeNull()
    })

    it('draws one in an inline chip too', () => {
      show({ preview: 'inline', items: [clip('clip.mp4')] })
      expect(document.querySelector('video')).toHaveAttribute('src', 'blob:clip.mp4')
    })

    it('falls back to the icon when there is no preview URL', () => {
      show({ preview: 'tile', items: [item('clip.mp4', { type: 'video/mp4' })] })
      expect(document.querySelector('video')).toBeNull()
      expect(screen.getByText('clip.mp4')).toBeInTheDocument()
    })
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
        state: 'uploading',
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
        state: 'uploading',
        items: [item('a.png', { progress: { fraction: 0.25, state: 'uploading' } })],
      })
      expect(screen.getByText('256 B of 1.0 KB')).toBeInTheDocument()
    })

    it('leaves the plain size on queued and finished files', () => {
      show({
        preview: 'tile',
        state: 'uploading',
        items: [
          item('a.png', { progress: { fraction: 0, state: 'waiting' } }),
          item('b.png', { progress: { fraction: 1, state: 'sent' } }),
        ],
      })
      expect(screen.getAllByText('1.0 KB')).toHaveLength(2)
    })

    // Comment trees hand one useUploadProgress to every box in the tree, so a
    // box that is not sending receives the sending box's slices. Drawing them
    // fills the wrong files.
    it('ignores slices unless this composer is the one sending', () => {
      show({
        preview: 'tile',
        state: 'idle',
        items: [item('a.png', { progress: { fraction: 0.5, state: 'uploading' } })],
      })
      expect(document.querySelector('[data-slot=attachment-progress]')).toBeNull()
      expect(screen.getByText('1.0 KB')).toBeInTheDocument()
    })

    it('still ignores them for a file the composer marked as failed', () => {
      show({
        preview: 'tile',
        state: 'uploading',
        items: [
          item('a.png', {
            state: 'error',
            progress: { fraction: 0.5, state: 'uploading' },
          }),
        ],
      })
      expect(document.querySelector('[data-slot=attachment-progress]')).toBeNull()
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
        state: 'uploading',
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
        const first = tileName(this) === 'a.png'
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

  // Dragging was the only way to change the order, which left a keyboard with
  // no way in at all.
  describe('keyboard reordering', () => {
    const tile = (name: string) =>
      screen.getByText(name).closest('[data-slot=attachment-tile]')!

    it('moves the focused tile with the arrow keys', () => {
      const onReorder = vi.fn()
      show({ preview: 'tile', onReorder })

      fireEvent.keyDown(tile('a.png'), { key: 'ArrowRight' })
      expect(onReorder).toHaveBeenCalledWith(0, 1)

      fireEvent.keyDown(tile('b.png'), { key: 'ArrowLeft' })
      expect(onReorder).toHaveBeenCalledWith(1, 0)
    })

    it('stops at the ends of the list', () => {
      const onReorder = vi.fn()
      show({ preview: 'tile', onReorder })

      fireEvent.keyDown(tile('a.png'), { key: 'ArrowLeft' })
      fireEvent.keyDown(tile('b.png'), { key: 'ArrowRight' })

      expect(onReorder).not.toHaveBeenCalled()
    })

    // Same wall the pointer meets, or the two ways of reordering would disagree
    // about what the list is allowed to become.
    it('holds inside its own block when the media is grouped', () => {
      const onReorder = vi.fn()
      show({
        preview: 'tile',
        groupMedia: true,
        onReorder,
        items: [item('notes.md', { type: 'text/plain' }), item('a.png'), item('b.png')],
      })

      // b.png is drawn last in the media block, with the file block after it.
      fireEvent.keyDown(tile('b.png'), { key: 'ArrowRight' })
      expect(onReorder).not.toHaveBeenCalled()
    })

    it('leaves the tiles static when there is nothing to reorder', () => {
      show({ preview: 'tile' })
      expect(tile('a.png')).not.toHaveAttribute('tabindex')
    })

    it('freezes the keys while a send is in flight', () => {
      const onReorder = vi.fn()
      show({ preview: 'tile', onReorder, state: 'uploading' })

      fireEvent.keyDown(tile('a.png'), { key: 'ArrowRight' })
      expect(onReorder).not.toHaveBeenCalled()
    })
  })

  // Captions ride the media tiles: the button opens the editor, the editor
  // hands back what was saved, and the caller owns where it lands.
  describe('captions', () => {
    it('offers the caption button on media tiles when asked', () => {
      show({ preview: 'tile', onCaption: vi.fn() })
      expect(screen.getAllByRole('button', { name: 'Add caption' })).toHaveLength(2)
    })

    it('offers nothing without the callback, or on non-media files', () => {
      show({ preview: 'tile' })
      expect(screen.queryByRole('button', { name: 'Add caption' })).toBeNull()

      show({
        preview: 'tile',
        onCaption: vi.fn(),
        items: [item('notes.md', { type: 'text/plain' })],
      })
      expect(screen.queryByRole('button', { name: 'Add caption' })).toBeNull()
    })

    it('names the button by whether a caption exists', () => {
      show({
        preview: 'tile',
        onCaption: vi.fn(),
        items: [item('a.png', { caption: 'The harbour' }), item('b.png')],
      })
      expect(screen.getByRole('button', { name: 'Edit caption' })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Add caption' })).toBeInTheDocument()
    })

    it('shows the caption in place of the size line', () => {
      show({ preview: 'tile', items: [item('a.png', { caption: 'The harbour' })] })
      expect(screen.getByText('The harbour')).toBeInTheDocument()
      expect(screen.queryByText('1.0 KB')).toBeNull()
    })

    it('saves through the editor by staged index', () => {
      const onCaption = vi.fn()
      show({ preview: 'tile', onCaption })

      fireEvent.click(screen.getAllByRole('button', { name: 'Add caption' })[1])
      fireEvent.change(screen.getByRole('textbox', { name: 'Caption' }), {
        target: { value: 'The harbour' },
      })
      fireEvent.click(screen.getByRole('button', { name: /save/i }))

      expect(onCaption).toHaveBeenCalledWith(1, 'The harbour')
    })

    it('saves on Enter and keeps Shift+Enter for a line break', () => {
      const onCaption = vi.fn()
      show({ preview: 'tile', onCaption })

      fireEvent.click(screen.getAllByRole('button', { name: 'Add caption' })[0])
      const editor = screen.getByRole('textbox', { name: 'Caption' })
      fireEvent.change(editor, { target: { value: 'Quay' } })
      fireEvent.keyDown(editor, { key: 'Enter', shiftKey: true })
      expect(onCaption).not.toHaveBeenCalled()
      fireEvent.keyDown(editor, { key: 'Enter' })

      expect(onCaption).toHaveBeenCalledWith(0, 'Quay')
    })

    it('withdraws the caption buttons while a send is in flight', () => {
      show({ preview: 'tile', onCaption: vi.fn(), state: 'uploading' })
      expect(screen.queryByRole('button', { name: 'Add caption' })).toBeNull()
    })
  })

  // The add tile is the only thing an empty composer has to show, so an empty
  // list with one is not the same as an empty list without.
  it('renders the add slot, with or without staged files', () => {
    show({ preview: 'tile', addSlot: <button type='button'>add</button> })
    expect(screen.getByText('add')).toBeInTheDocument()

    const { container } = show({ items: [], addSlot: <button type='button'>add</button> })
    expect(container).not.toBeEmptyDOMElement()
  })

  // The posted comment draws its media in one block and everything else in
  // another, so a composer that interleaves the two shows an order the post
  // will not keep. Grouping changes how the staged array is drawn and nothing
  // else, which is what every index handed back to the caller has to reflect.
  describe('grouped media', () => {
    const doc = (name: string) => item(name, { type: 'text/plain' })
    const staged = [doc('notes.md'), item('a.png'), item('b.png')]

    // The tile's own text is the name paragraph. Read that rather than the
    // tile's whole textContent: the grip chip puts the position in front of it.
    const drawnNames = () =>
      Array.from(document.querySelectorAll('[data-slot=attachment-tile]')).map(
        (tile) => tile.querySelector('p')?.textContent
      )

    // jsdom does no layout, so the tiles are handed a row of rectangles in the
    // order they are drawn, 160px apart and 100px wide.
    function layOut(names: string[]) {
      vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(
        function (this: HTMLElement) {
          if (this.getAttribute('data-slot') !== 'attachment-tile') {
            return { left: 0, top: 0, right: 1000, bottom: 100 } as DOMRect
          }
          const slot = names.findIndex((name) => tileName(this) === name)
          return {
            left: slot * 160,
            top: 0,
            right: slot * 160 + 100,
            bottom: 100,
          } as DOMRect
        }
      )
    }

    function dragTile(name: string, toX: number) {
      const tile = screen.getByText(name).closest('[data-slot=attachment-tile]')!
      fireEvent.pointerDown(tile, { pointerId: 1, pointerType: 'mouse', button: 0, clientX: 50, clientY: 50 })
      // Far enough to start the drag, then on to the slot being aimed at.
      fireEvent.pointerMove(window, { pointerId: 1, pointerType: 'mouse', clientX: 60, clientY: 50 })
      fireEvent.pointerMove(window, { pointerId: 1, pointerType: 'mouse', clientX: toX, clientY: 50 })
    }

    afterEach(() => {
      vi.restoreAllMocks()
      vi.unstubAllGlobals()
    })

    it('draws the media first and the rest after', () => {
      show({
        preview: 'tile',
        groupMedia: true,
        items: [doc('notes.md'), item('a.png'), doc('spec.pdf'), item('b.png')],
      })
      expect(drawnNames()).toEqual(['a.png', 'b.png', 'notes.md', 'spec.pdf'])
    })

    // Video is media to the gallery, so it has to be media here too, or the
    // composer and the posted attachment disagree about where a clip belongs.
    it('sorts video into the media block, not the file block', () => {
      show({
        preview: 'tile',
        groupMedia: true,
        items: [doc('notes.md'), item('clip.mp4', { type: 'video/mp4' }), item('a.png')],
      })
      expect(drawnNames()).toEqual(['clip.mp4', 'a.png', 'notes.md'])
    })

    it('keeps the staged order inside each block', () => {
      show({
        preview: 'tile',
        groupMedia: true,
        items: [item('b.png'), doc('spec.pdf'), item('a.png'), doc('notes.md')],
      })
      expect(drawnNames()).toEqual(['b.png', 'a.png', 'spec.pdf', 'notes.md'])
    })

    it('leaves the staged order alone when it is off', () => {
      show({ preview: 'tile', items: staged })
      expect(drawnNames()).toEqual(['notes.md', 'a.png', 'b.png'])
    })

    // The array the caller holds is still the staged one, so the index it is
    // handed has to point into that rather than at the tile's place on screen.
    it('removes by staged index, not by drawn position', () => {
      const onRemove = vi.fn()
      show({ preview: 'tile', groupMedia: true, onRemove, items: staged })

      // a.png is drawn first and staged second.
      fireEvent.click(screen.getAllByRole('button', { name: 'Remove' })[0])

      expect(onRemove).toHaveBeenCalledWith(1)
    })

    // The blocks refuse each other's drops, which read as a broken drag while
    // nothing on screen said there were two blocks at all.
    it('names the two blocks when the app supplies names', () => {
      show({
        preview: 'tile',
        layout: 'grid',
        groupMedia: true,
        items: staged,
        blockLabels: { media: 'Photos', files: 'Files' },
      })
      expect(screen.getByText('Photos')).toBeInTheDocument()
      expect(screen.getByText('Files')).toBeInTheDocument()
    })

    it('leaves out the file label when every attachment is media', () => {
      show({
        preview: 'tile',
        layout: 'grid',
        groupMedia: true,
        items: [item('a.png'), item('b.png')],
        blockLabels: { media: 'Photos', files: 'Files' },
      })
      expect(screen.getByText('Photos')).toBeInTheDocument()
      expect(screen.queryByText('Files')).not.toBeInTheDocument()
    })

    it('reorders by staged index, not by drawn position', () => {
      const onReorder = vi.fn()
      const frames: FrameRequestCallback[] = []
      vi.stubGlobal('requestAnimationFrame', (f: FrameRequestCallback) => frames.push(f))
      vi.stubGlobal('cancelAnimationFrame', () => {})
      layOut(['a.png', 'b.png', 'notes.md'])

      show({ preview: 'tile', groupMedia: true, onReorder, items: staged })
      dragTile('a.png', 210)
      frames.splice(0).forEach((f) => f(0))

      // Drawn 0 onto drawn 1 is staged 1 onto staged 2.
      expect(onReorder).toHaveBeenCalledWith(1, 2)
    })

    // Landing a photo in the file block would put it at that block's edge
    // rather than under the pointer, so those slots turn it away.
    it('holds a drag inside the block it started in', () => {
      const onReorder = vi.fn()
      const frames: FrameRequestCallback[] = []
      vi.stubGlobal('requestAnimationFrame', (f: FrameRequestCallback) => frames.push(f))
      vi.stubGlobal('cancelAnimationFrame', () => {})
      layOut(['a.png', 'b.png', 'notes.md'])

      show({ preview: 'tile', groupMedia: true, onReorder, items: staged })
      dragTile('a.png', 370)
      frames.splice(0).forEach((f) => f(0))

      expect(onReorder).not.toHaveBeenCalled()

      // And the refusal did not end the gesture, which is also what stops this
      // passing on a drag that never started: back over its own block it moves.
      fireEvent.pointerMove(window, { pointerId: 1, pointerType: 'mouse', clientX: 210, clientY: 50 })
      frames.splice(0).forEach((f) => f(0))

      expect(onReorder).toHaveBeenCalledWith(1, 2)
    })
  })
})
