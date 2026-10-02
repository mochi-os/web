// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: Apache-2.0

import { render, screen, within } from '@testing-library/react'
import { I18nProvider } from '@lingui/react'
import { i18n } from '@lingui/core'
import { Trash2 } from 'lucide-react'
import { describe, expect, it } from 'vitest'
import { ConfirmDialog } from './confirm-dialog'
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

describe.each([
  ['ResponsiveConfirmDialog', ResponsiveConfirmDialog],
  ['ConfirmDialog', ConfirmDialog],
])('%s confirm icon', (_, Dialog) => {
  const renderDialog = (isLoading: boolean) =>
    render(
      <I18nProvider i18n={i18n}>
        <Dialog
          open
          onOpenChange={() => undefined}
          title='Delete item'
          desc='This cannot be undone.'
          confirmText='Delete'
          icon={<Trash2 data-testid='confirm-icon' className='size-4' />}
          destructive
          handleConfirm={() => undefined}
          isLoading={isLoading}
        />
      </I18nProvider>
    )

  it('leads the confirm label with the icon', () => {
    renderDialog(false)

    const confirm = screen.getByRole('button', { name: 'Delete' })
    expect(confirm.firstChild).toBe(within(confirm).getByTestId('confirm-icon'))
    expect(confirm).toHaveTextContent(/^Delete$/)
    expect(confirm.querySelector('[data-slot="button-spinner"]')).toBeNull()
  })

  it('shows the spinner in place of the icon while loading', () => {
    renderDialog(true)

    const confirm = screen.getByRole('button', { name: 'Delete' })
    const spinner = confirm.querySelector('[data-slot="button-spinner"]')
    expect(within(confirm).queryByTestId('confirm-icon')).toBeNull()
    expect(confirm.firstChild).toBe(spinner)
    expect(spinner).toHaveClass('size-4', 'animate-spin')
  })
})
