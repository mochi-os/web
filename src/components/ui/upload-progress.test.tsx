// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: Apache-2.0

// The bar every composer shows while a file goes up. It must say how far along
// it is while the body is leaving the browser, and say nothing about a value
// once the amount is not known.

import { render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { i18n } from '@lingui/core'
import { I18nProvider } from '@lingui/react'
import type { Upload } from '../../hooks/use-upload-progress'
import { UploadProgress } from './upload-progress'

function show(progress: Upload | null) {
  return render(
    <I18nProvider i18n={i18n}>
      <UploadProgress progress={progress} />
    </I18nProvider>
  )
}

function bar() {
  return screen.getByRole('progressbar', { name: 'Upload progress' })
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe('UploadProgress', () => {
  it('draws nothing when there is no upload', () => {
    const { container } = show(null)

    expect(container).toBeEmptyDOMElement()
  })

  it('shows the share sent while the body is leaving the browser', () => {
    show({ sent: 40, total: 100, phase: 'uploading' })

    expect(bar()).toHaveAttribute('aria-valuenow', '40')
  })

  it('stops at full when more than the total is reported', () => {
    show({ sent: 120, total: 100, phase: 'uploading' })

    expect(bar()).toHaveAttribute('aria-valuenow', '100')
  })

  it('claims no value while the server processes the upload', () => {
    show({ sent: 100, total: 100, phase: 'processing' })

    expect(bar()).not.toHaveAttribute('aria-valuenow')
    expect(screen.getByText('Processing…')).toBeInTheDocument()
  })

  it('claims no value when the total is not known', () => {
    show({ sent: 40, total: null, phase: 'uploading' })

    expect(bar()).not.toHaveAttribute('aria-valuenow')
  })

  it('treats an empty file as unknown, not as NaN', () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    show({ sent: 0, total: 0, phase: 'uploading' })

    expect(bar()).not.toHaveAttribute('aria-valuenow')
    expect(error).not.toHaveBeenCalled()
  })
})
