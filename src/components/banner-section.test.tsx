// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: Apache-2.0

// The banner editor is shared by feeds and forums. Two behaviours worth pinning:
// the textarea caps at the same 10000-character limit the server enforces, and a
// failed load surfaces its error rather than presenting a blank, savable editor.

import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { I18nProvider } from '@lingui/react'
import { i18n } from '@lingui/core'
import { BannerSection, type BannerApi } from './banner-section'

function renderSection(api: BannerApi) {
  return render(
    <I18nProvider i18n={i18n}>
      <BannerSection entityId='e1' api={api} />
    </I18nProvider>
  )
}

describe('BannerSection', () => {
  it('caps the textarea at the server limit', async () => {
    const api: BannerApi = {
      getBanner: vi.fn().mockResolvedValue({ data: { banner: 'hello' } }),
      setBanner: vi.fn().mockResolvedValue(undefined),
    }
    renderSection(api)

    const textarea = await screen.findByRole('textbox')
    expect(textarea).toHaveAttribute('maxlength', '10000')
  })

  it('surfaces a failed load instead of a blank editor', async () => {
    const api: BannerApi = {
      getBanner: vi.fn().mockRejectedValue(new Error('directory unreachable')),
      setBanner: vi.fn().mockResolvedValue(undefined),
    }
    renderSection(api)

    expect(
      await screen.findByText(/directory unreachable/)
    ).toBeInTheDocument()
    expect(screen.queryByRole('textbox')).toBeNull()
  })

  it('falls back to a message when the load error carries none', async () => {
    const api: BannerApi = {
      getBanner: vi.fn().mockRejectedValue({}),
      setBanner: vi.fn().mockResolvedValue(undefined),
    }
    renderSection(api)

    expect(await screen.findByText(/Failed to load banner/)).toBeInTheDocument()
  })
})
