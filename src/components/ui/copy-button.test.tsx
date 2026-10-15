// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: Apache-2.0

import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { i18n } from '@lingui/core'
import { I18nProvider } from '@lingui/react'
import { CopyButton } from './copy-button'

// The shell bridge picks a clipboard path by environment; the button's own
// behaviour is what is under test here.
vi.mock('../../lib/shell-bridge', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../lib/shell-bridge')>()),
  shellClipboardWrite: vi.fn(async () => true),
}))

i18n.loadAndActivate({ locale: 'en', messages: {} })

describe('CopyButton', () => {
  it('still copies when a wrapper passes its own click handler', async () => {
    const { shellClipboardWrite } = await import('../../lib/shell-bridge')
    const wrapperClick = vi.fn()
    render(
      <I18nProvider i18n={i18n}>
        <CopyButton value='copied' onClick={wrapperClick} />
      </I18nProvider>
    )
    fireEvent.click(screen.getByRole('button'))
    expect(wrapperClick).toHaveBeenCalled()
    await waitFor(() =>
      expect(shellClipboardWrite).toHaveBeenCalledWith('copied')
    )
  })
})
