// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: Apache-2.0

// Pins the header filter box to SearchInput: the desktop field carries the
// clear button, and the phone field leaves clearing to its close button so
// there is never a second X.

import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { I18nProvider } from '@lingui/react'
import { i18n } from '@lingui/core'
import { HeaderSearch } from './header-search'

function renderSearch(value: string, onValueChange = vi.fn()) {
  render(
    <I18nProvider i18n={i18n}>
      <HeaderSearch
        value={value}
        onValueChange={onValueChange}
        placeholder='Search...'
        label='Search contacts'
      />
    </I18nProvider>
  )
  return onValueChange
}

describe('HeaderSearch', () => {
  it('folds the phone field to an icon until it is opened', () => {
    renderSearch('')
    expect(screen.getAllByRole('searchbox')).toHaveLength(1)
    fireEvent.click(screen.getByRole('button', { name: 'Search contacts' }))
    expect(screen.getAllByRole('searchbox')).toHaveLength(2)
  })

  it('shows one clear button, on the desktop field', () => {
    const onValueChange = renderSearch('anna')
    const clears = screen.getAllByRole('button', { name: 'Clear search' })
    expect(clears).toHaveLength(1)
    fireEvent.click(clears[0])
    expect(onValueChange).toHaveBeenCalledWith('')
  })

  it('clears from the phone close button', () => {
    const onValueChange = renderSearch('anna')
    fireEvent.click(screen.getByRole('button', { name: 'Close search' }))
    expect(onValueChange).toHaveBeenCalledWith('')
  })
})
