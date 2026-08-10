// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: Apache-2.0

// The pickers reset their value so the same file can be chosen twice, so two
// staged files carrying identical metadata is a state the composer has to be
// able to render and address.

import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { I18nProvider } from '@lingui/react'
import { i18n } from '@lingui/core'
import { ComposerAttachments } from './comment-composer'

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
