// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: Apache-2.0

import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { I18nProvider } from '@lingui/react'
import { i18n } from '@lingui/core'
import { TreeTableHeader } from './tree-table-header'

describe('TreeTableHeader', () => {
  it('never shows a field id in place of a missing name', () => {
    render(
      <I18nProvider i18n={i18n}>
        <table>
          <TreeTableHeader fields={[{ id: 'fld_9', name: '', fieldtype: 'text' }]} showClass={false} showId={false} />
        </table>
      </I18nProvider>
    )
    expect(screen.getByText('Unknown')).toBeInTheDocument()
    expect(screen.queryByText('fld_9')).not.toBeInTheDocument()
  })
})
