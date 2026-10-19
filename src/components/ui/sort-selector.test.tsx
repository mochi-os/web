// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: Apache-2.0
import { i18n } from '@lingui/core'
import { I18nProvider } from '@lingui/react'
import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { SortSelector } from './sort-selector'

function renderSelector(value: Parameters<typeof SortSelector>[0]['value']) {
  render(
    <I18nProvider i18n={i18n}>
      <SortSelector
        value={value}
        onValueChange={vi.fn()}
        options={['new', 'top']}
        extra={[{ value: 'old', label: 'Oldest first', icon: null }]}
      />
    </I18nProvider>
  )
}

describe('SortSelector extra', () => {
  it('shows the app sort when it is the one chosen', () => {
    renderSelector('old')
    expect(screen.getByText('Oldest first')).toBeInTheDocument()
  })

  it('keeps the shared sorts it was given', () => {
    renderSelector('top')
    expect(screen.getByText('Top')).toBeInTheDocument()
  })
})
