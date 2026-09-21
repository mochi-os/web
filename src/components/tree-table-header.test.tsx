// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: Apache-2.0

import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { I18nProvider } from '@lingui/react'
import { i18n } from '@lingui/core'
import { TreeTableHeader } from './tree-table-header'
import { treeTableMinWidth } from './tree-table-width'

describe('TreeTableHeader', () => {
  // The handle column and the first content column stay put while the rest of
  // the table scrolls sideways; the title is the first content column here.
  it('pins the handle and first content header cells', () => {
    const { container } = render(
      <I18nProvider i18n={i18n}>
        <table>
          <TreeTableHeader
            fields={[
              { id: 'title', name: 'Title', fieldtype: 'text' },
              { id: 'due', name: 'Due', fieldtype: 'date' },
            ]}
            titleFieldId='title'
          />
        </table>
      </I18nProvider>
    )
    const cells = container.querySelectorAll('th')
    expect(cells[0]).toHaveClass('start-0')
    expect(cells[1]).toHaveClass('start-10')
    expect(cells[2]).not.toHaveClass('start-0')
    expect(cells[2]).not.toHaveClass('start-10')
  })

  // A fixed-layout table ignores min-width on its cells, so the table itself
  // carries the floor: handle 2.5, class 6, id 5, title 15, date 8, user 10.
  it('sums the column widths into the table minimum', () => {
    expect(
      treeTableMinWidth({
        fields: [
          { id: 'title', name: 'Title', fieldtype: 'text' },
          { id: 'due', name: 'Due', fieldtype: 'date' },
          { id: 'owner', name: 'Owner', fieldtype: 'user' },
        ],
        showClass: true,
        showId: true,
        titleFieldId: 'title',
      })
    ).toBe('46.5rem')
  })

  it('never shows a field id in place of a missing name', () => {
    render(
      <I18nProvider i18n={i18n}>
        <table>
          <TreeTableHeader
            fields={[{ id: 'fld_9', name: '', fieldtype: 'text' }]}
            showClass={false}
            showId={false}
          />
        </table>
      </I18nProvider>
    )
    expect(screen.getByText('Unknown')).toBeInTheDocument()
    expect(screen.queryByText('fld_9')).not.toBeInTheDocument()
  })
})
