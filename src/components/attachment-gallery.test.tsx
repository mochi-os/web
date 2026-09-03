// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: Apache-2.0

// A tile whose bytes fail to load must say WHY: an <img>'s error event cannot
// carry the status, so the gallery probes the same URL once and renders the
// server's answer - "Unavailable" for a source that cannot be reached (503,
// retried server-side after a backoff), "Not found" for bytes that are gone
// (404). One broken glyph for both was the client contradicting a server that
// had started telling the truth.

import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { I18nProvider } from '@lingui/react'
import { i18n } from '@lingui/core'
import { AttachmentGallery, type GalleryAttachment } from './attachment-gallery'
import { shellDownload } from '../lib/shell-bridge'

vi.mock('../lib/shell-bridge', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../lib/shell-bridge')>()),
  shellDownload: vi.fn(async () => true),
}))

i18n.load('en', {})
i18n.activate('en')

function attachment(extra: Partial<GalleryAttachment> = {}): GalleryAttachment {
  return {
    id: 'a1',
    name: 'photo.jpg',
    type: 'image/jpeg',
    size: 1234,
    url: '/app/entity/-/attachments/a1',
    ...extra,
  }
}

function show(attachments: GalleryAttachment[] = [attachment()]) {
  return render(
    <I18nProvider i18n={i18n}>
      <AttachmentGallery attachments={attachments} />
    </I18nProvider>
  )
}

function probe(status: number) {
  const mock = vi.fn().mockResolvedValue({ status })
  vi.stubGlobal('fetch', mock)
  return mock
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('AttachmentGallery failure tiles', () => {
  it('renders an unavailable tile when the server answers 503', async () => {
    const fetched = probe(503)
    show()
    fireEvent.error(screen.getByAltText('photo.jpg'))
    await waitFor(() => expect(screen.getByText('Unavailable')).toBeInTheDocument())
    expect(fetched).toHaveBeenCalledWith('/app/entity/-/attachments/a1', {
      credentials: 'same-origin',
    })
  })

  it('renders a not-found tile when the server answers 404', async () => {
    probe(404)
    show()
    fireEvent.error(screen.getByAltText('photo.jpg'))
    await waitFor(() => expect(screen.getByText('Not found')).toBeInTheDocument())
    expect(screen.queryByText('Unavailable')).not.toBeInTheDocument()
  })

  it('treats an unreachable server as unavailable, not gone', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')))
    show()
    fireEvent.error(screen.getByAltText('photo.jpg'))
    await waitFor(() => expect(screen.getByText('Unavailable')).toBeInTheDocument())
  })

  it('never probes a tile that loads', () => {
    const fetched = probe(200)
    show()
    fireEvent.load(screen.getByAltText('photo.jpg'))
    expect(fetched).not.toHaveBeenCalled()
    expect(screen.queryByText('Unavailable')).not.toBeInTheDocument()
    expect(screen.queryByText('Not found')).not.toBeInTheDocument()
  })

  it('clicking a failed tile retries the load instead of opening the lightbox', async () => {
    probe(503)
    show()
    fireEvent.error(screen.getByAltText('photo.jpg'))
    await waitFor(() => expect(screen.getByText('Unavailable')).toBeInTheDocument())
    fireEvent.click(screen.getByText('Unavailable'))
    // The placeholder is gone and the image is back for another attempt -
    // and the click stopped at the placeholder, so no lightbox appeared.
    expect(screen.queryByText('Unavailable')).not.toBeInTheDocument()
    expect(screen.getByAltText('photo.jpg')).toBeInTheDocument()
    expect(document.querySelector('[role=dialog]')).toBeNull()
  })
})

describe('AttachmentGallery file chips', () => {
  it('downloads through the shell instead of exposing a tokened href', () => {
    const { container } = show([
      attachment({ id: 'f1', name: 'notes.pdf', type: 'application/pdf', url: '/app/e/-/attachments/f1' }),
    ])
    // No anchor at all: the resolved URL carries the app token, which must
    // not sit in the DOM, and a download link is inert inside the shell.
    expect(container.querySelector('a[href]')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'notes.pdf' }))
    expect(shellDownload).toHaveBeenCalledWith('/app/e/-/attachments/f1', 'notes.pdf')
  })
})
