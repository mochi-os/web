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

function probe(status: number, type = 'image/jpeg') {
  const mock = vi.fn().mockResolvedValue({
    status,
    headers: new Headers({ 'content-type': type }),
  })
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
    await waitFor(() =>
      expect(screen.getByText('Unavailable')).toBeInTheDocument()
    )
    expect(fetched).toHaveBeenCalledWith('/app/entity/-/attachments/a1', {
      credentials: 'same-origin',
    })
  })

  it('renders a not-found tile when the server answers 404', async () => {
    probe(404)
    show()
    fireEvent.error(screen.getByAltText('photo.jpg'))
    await waitFor(() =>
      expect(screen.getByText('Not found')).toBeInTheDocument()
    )
    expect(screen.queryByText('Unavailable')).not.toBeInTheDocument()
  })

  it('treats an unreachable server as unavailable, not gone', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockRejectedValue(new TypeError('Failed to fetch'))
    )
    show()
    fireEvent.error(screen.getByAltText('photo.jpg'))
    await waitFor(() =>
      expect(screen.getByText('Unavailable')).toBeInTheDocument()
    )
  })

  it('loads the image again when the probe finds its bytes, rather than calling it missing', async () => {
    const fetched = probe(200)
    show()
    fireEvent.error(screen.getByAltText('photo.jpg'))
    await waitFor(() => expect(fetched).toHaveBeenCalledTimes(1))
    await waitFor(() =>
      expect(screen.getByAltText('photo.jpg')).toBeInTheDocument()
    )
    expect(screen.queryByText('Not found')).not.toBeInTheDocument()
    expect(screen.queryByText('Unavailable')).not.toBeInTheDocument()
  })

  it('stops loading again after a bounded number of tries', async () => {
    const fetched = probe(200)
    show()
    for (let tries = 1; tries <= 3; tries++) {
      fireEvent.error(screen.getByAltText('photo.jpg'))
      await waitFor(() => expect(fetched).toHaveBeenCalledTimes(tries))
    }
    await waitFor(() =>
      expect(screen.getByText('Unavailable')).toBeInTheDocument()
    )
  })

  it('reads only the status of the probe, cancelling its body', async () => {
    const cancel = vi.fn().mockResolvedValue(undefined)
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        status: 200,
        headers: new Headers({ 'content-type': 'image/jpeg' }),
        body: { cancel },
      })
    )
    show()
    fireEvent.error(screen.getByAltText('photo.jpg'))
    await waitFor(() => expect(cancel).toHaveBeenCalled())
  })

  it('calls a page answered in place of an image missing, without loading it again', async () => {
    const fetched = probe(200, 'text/html; charset=utf-8')
    show()
    fireEvent.error(screen.getByAltText('photo.jpg'))
    await waitFor(() =>
      expect(screen.getByText('Not found')).toBeInTheDocument()
    )
    expect(fetched).toHaveBeenCalledTimes(1)
  })

  it('treats a refused probe as unavailable, not gone', async () => {
    probe(401)
    show()
    fireEvent.error(screen.getByAltText('photo.jpg'))
    await waitFor(() =>
      expect(screen.getByText('Unavailable')).toBeInTheDocument()
    )
    expect(screen.queryByText('Not found')).not.toBeInTheDocument()
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
    await waitFor(() =>
      expect(screen.getByText('Unavailable')).toBeInTheDocument()
    )
    fireEvent.click(screen.getByText('Unavailable'))
    // The placeholder is gone and the image is back for another attempt -
    // and the click stopped at the placeholder, so no lightbox appeared.
    expect(screen.queryByText('Unavailable')).not.toBeInTheDocument()
    expect(screen.getByAltText('photo.jpg')).toBeInTheDocument()
    expect(document.querySelector('[role=dialog]')).toBeNull()
  })
})

describe('AttachmentGallery tile loading', () => {
  // An eager tile fetches its bytes as the page renders, so a photo feed
  // pulled every preview on the page, those far below the screen included.
  it('loads a photo tile lazily and decodes it off the main thread', () => {
    show()
    const tile = screen.getByAltText('photo.jpg')
    expect(tile).toHaveAttribute('loading', 'lazy')
    expect(tile).toHaveAttribute('decoding', 'async')
  })

  it('keeps a retried tile lazy', async () => {
    probe(503)
    show()
    fireEvent.error(screen.getByAltText('photo.jpg'))
    await waitFor(() =>
      expect(screen.getByText('Unavailable')).toBeInTheDocument()
    )
    fireEvent.click(screen.getByText('Unavailable'))
    expect(screen.getByAltText('photo.jpg')).toHaveAttribute('loading', 'lazy')
  })

  it('draws the preview variant where the app asks for it', () => {
    render(
      <I18nProvider i18n={i18n}>
        <AttachmentGallery
          attachments={[attachment()]}
          getPreviewUrl={(att) => `/app/entity/-/attachments/${att.id}/preview`}
        />
      </I18nProvider>
    )
    expect(screen.getByAltText('photo.jpg')).toHaveAttribute(
      'src',
      '/app/entity/-/attachments/a1/preview'
    )
  })
})

// A gallery tile is drawn about 140px tall, so a 640px medium covers it on any
// screen where the tile stays small, at a third of the preview's bytes. A tile
// drawn larger than the medium still asks for the preview.
describe('AttachmentGallery tile variant', () => {
  function drawnAt(width: number, height: number, density = 2) {
    vi.stubGlobal('devicePixelRatio', density)
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({
      width,
      height,
      top: 0,
      left: 0,
      right: width,
      bottom: height,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    })
  }

  function showWithMedium() {
    render(
      <I18nProvider i18n={i18n}>
        <AttachmentGallery
          attachments={[attachment()]}
          getPreviewUrl={(att) => `/app/entity/-/attachments/${att.id}/preview`}
          getMediumUrl={(att) => `/app/entity/-/attachments/${att.id}/medium`}
        />
      </I18nProvider>
    )
    return screen.getByAltText('photo.jpg')
  }

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('asks a tile drawn within the medium for the medium', () => {
    drawnAt(210, 140)
    expect(showWithMedium()).toHaveAttribute(
      'src',
      '/app/entity/-/attachments/a1/medium'
    )
  })

  it('asks a tile drawn past the medium for the preview', () => {
    drawnAt(700, 140)
    expect(showWithMedium()).toHaveAttribute(
      'src',
      '/app/entity/-/attachments/a1/preview'
    )
  })

  it('counts device pixels, not CSS pixels', () => {
    drawnAt(210, 140, 4)
    expect(showWithMedium()).toHaveAttribute(
      'src',
      '/app/entity/-/attachments/a1/preview'
    )
  })

  it('takes the preview for a tile not yet laid out', () => {
    drawnAt(0, 0)
    expect(showWithMedium()).toHaveAttribute(
      'src',
      '/app/entity/-/attachments/a1/preview'
    )
  })
})

describe('AttachmentGallery file chips', () => {
  it('downloads through the shell instead of exposing a tokened href', () => {
    const { container } = show([
      attachment({
        id: 'f1',
        name: 'notes.pdf',
        type: 'application/pdf',
        url: '/app/e/-/attachments/f1',
      }),
    ])
    // No anchor at all: the resolved URL carries the app token, which must
    // not sit in the DOM, and a download link is inert inside the shell.
    expect(container.querySelector('a[href]')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'notes.pdf' }))
    expect(shellDownload).toHaveBeenCalledWith(
      '/app/e/-/attachments/f1',
      'notes.pdf'
    )
  })
})
