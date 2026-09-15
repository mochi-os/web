// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: Apache-2.0

import { render, screen } from '@testing-library/react'
import { I18nProvider } from '@lingui/react'
import { i18n } from '@lingui/core'
import { describe, expect, it } from 'vitest'
import { ResponsiveConfirmDialog } from './responsive-confirm-dialog'

describe('ResponsiveConfirmDialog loading state', () => {
  it('keeps the confirm label and disables both actions', () => {
    render(
      <I18nProvider i18n={i18n}>
        <ResponsiveConfirmDialog
          open
          onOpenChange={() => undefined}
          title='Delete item'
          desc='This cannot be undone.'
          confirmText='Delete'
          handleConfirm={() => undefined}
          isLoading
        />
      </I18nProvider>
    )

    const confirm = screen.getByRole('button', { name: 'Delete' })
    expect(confirm).toBeDisabled()
    expect(confirm).toHaveAttribute('aria-busy', 'true')
    expect(confirm.querySelector('[data-slot="button-spinner"]')).not.toBeNull()
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled()
  })
})
