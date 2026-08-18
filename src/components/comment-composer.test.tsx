// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: Apache-2.0

// The pickers reset their value so the same file can be chosen twice, so two
// staged files carrying identical metadata is a state the composer has to be
// able to render and address.

import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react'
import { I18nProvider } from '@lingui/react'
import { i18n } from '@lingui/core'
import { CommentBox, ComposerAttachments } from './comment-composer'

function pick(name: string): File {
  const file = new File(['xxxxxxxxxx'], name, { type: 'image/png' })
  Object.defineProperty(file, 'lastModified', { value: 1_700_000_000_000 })
  return file
}

function show(files: File[], onRemove = () => {}) {
  return render(
    <I18nProvider i18n={i18n}>
      <ComposerAttachments
        files={files}
        previewUrls={files.map(() => null)}
        onRemove={onRemove}
        onReorder={() => {}}
      />
    </I18nProvider>
  )
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe('ComposerAttachments with the same file staged twice', () => {
  it('gives the two tiles keys React can tell apart', () => {
    const errors = vi.spyOn(console, 'error').mockImplementation(() => {})

    show([pick('photo.png'), pick('photo.png')])

    expect(errors).not.toHaveBeenCalled()
    expect(screen.getAllByText('photo.png')).toHaveLength(2)
  })

  it('removes the copy whose button was pressed', () => {
    const first = pick('photo.png')
    const second = pick('photo.png')
    const onRemove = vi.fn()

    show([first, second], onRemove)
    fireEvent.click(screen.getAllByRole('button', { name: /remove/i })[1])

    expect(onRemove).toHaveBeenCalledWith(second)
  })
})

// The comment box is one component for every place a comment or reply is
// written, so what is asserted is the contract each host relies on: files
// travel with the send, a failure keeps them for Retry, a success clears
// them, and Cancel/Escape reach the host's guard - never mid-send.
describe('CommentBox', () => {
  // The send-shortcut chip asks matchMedia whether there is a keyboard; jsdom
  // has no matchMedia, so answer "a keyboard" and never change.
  beforeEach(() => {
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      writable: true,
      value: (media: string) => ({
        matches: false,
        media,
        addEventListener: () => {},
        removeEventListener: () => {},
      }),
    })
  })

  function box(props: Partial<React.ComponentProps<typeof CommentBox>> = {}) {
    const onSubmit = vi.fn(async () => {})
    const onValueChange = vi.fn()
    const utils = render(
      <I18nProvider i18n={i18n}>
        <CommentBox value='hello' onValueChange={onValueChange} onSubmit={onSubmit} {...props} />
      </I18nProvider>
    )
    return { ...utils, onSubmit, onValueChange }
  }

  function stage(container: HTMLElement, ...files: File[]) {
    const input = container.querySelector('input[type=file]') as HTMLInputElement
    fireEvent.change(input, { target: { files } })
  }

  it('sends the draft with the staged files and clears them on success', async () => {
    const onFilesChange = vi.fn()
    const { container, onSubmit } = box({ onFilesChange })
    const photo = pick('photo.png')

    stage(container, photo)
    expect(onFilesChange).toHaveBeenLastCalledWith(1)
    expect(screen.getByText('photo.png')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Submit comment' }))
    await waitFor(() => expect(onSubmit).toHaveBeenCalledWith('hello', [photo]))
    await waitFor(() => expect(screen.queryByText('photo.png')).not.toBeInTheDocument())
    expect(onFilesChange).toHaveBeenLastCalledWith(0)
  })

  it('sends without a files argument when nothing is staged', async () => {
    const { onSubmit } = box()
    fireEvent.click(screen.getByRole('button', { name: 'Submit comment' }))
    await waitFor(() => expect(onSubmit).toHaveBeenCalledWith('hello', undefined))
  })

  it('keeps the files and offers Retry when the send rejects', async () => {
    const onSubmit = vi.fn().mockRejectedValueOnce(new Error('down')).mockResolvedValueOnce(undefined)
    const { container } = box({ onSubmit })
    const photo = pick('photo.png')

    stage(container, photo)
    fireEvent.click(screen.getByRole('button', { name: 'Submit comment' }))
    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1))
    expect(screen.getByText('photo.png')).toBeInTheDocument()

    fireEvent.click(await screen.findByRole('button', { name: /retry/i }))
    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(2))
    expect(onSubmit).toHaveBeenLastCalledWith('hello', [photo])
  })

  it('shows Cancel only when a host handles closing, and routes Escape to it', () => {
    box()
    expect(screen.queryByRole('button', { name: 'Cancel comment' })).not.toBeInTheDocument()

    cleanup()
    const onClose = vi.fn()
    box({ onClose })
    fireEvent.click(screen.getByRole('button', { name: 'Cancel comment' }))
    fireEvent.keyDown(screen.getByRole('textbox'), { key: 'Escape' })
    expect(onClose).toHaveBeenCalledTimes(2)
  })

  it('carries the reply labels when asked', () => {
    box({ kind: 'reply', onClose: () => {} })
    expect(screen.getByRole('button', { name: 'Submit reply' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Cancel reply' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Attach reply files' })).toBeInTheDocument()
  })
})
