// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: Apache-2.0

import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { I18nProvider } from '@lingui/react'
import { i18n } from '@lingui/core'
import { LoadMore } from './load-more'

describe('LoadMore', () => {
  it('formats both counts for the locale', () => {
    render(
      <I18nProvider i18n={i18n}>
        <LoadMore hasMore isLoading={false} onLoadMore={() => {}} totalShown={1000} total={12345} />
      </I18nProvider>
    )
    expect(screen.getByText('Showing 1,000 of 12,345')).toBeInTheDocument()
  })
})
