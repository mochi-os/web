// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: Apache-2.0

import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { I18nProvider } from '@lingui/react'
import { i18n } from '@lingui/core'
import { DataChip } from './data-chip'

describe('DataChip', () => {
  it('shows the label as the caller wrote it, adding no separator', () => {
    render(
      <I18nProvider i18n={i18n}>
        <DataChip label='Server' value='node-a' />
      </I18nProvider>
    )
    expect(screen.getByText('Server')).toBeInTheDocument()
    expect(screen.queryByText('Server:')).toBeNull()
  })
})
