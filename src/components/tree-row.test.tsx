// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: Apache-2.0

import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { I18nProvider } from '@lingui/react'
import { i18n } from '@lingui/core'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { TreeRow } from './tree-row'

describe('TreeRow', () => {
  it('shows Unknown, not an id, for a class or person it cannot name', () => {
    render(
      <QueryClientProvider client={new QueryClient()}>
        <I18nProvider i18n={i18n}>
          <table>
            <tbody>
              <TreeRow
                object={{
                  id: 'o1',
                  class: 'cls_7',
                  values: { owner: 'usr_3' },
                }}
                depth={0}
                hasChildren={false}
                isExpanded={false}
                anySiblingHasChildren={false}
                fields={[{ id: 'owner', name: 'Owner', fieldtype: 'user' }]}
                options={{}}
                peopleMap={{}}
                classMap={{}}
                showId={false}
                isDragOver={false}
                isDragBefore={false}
                isDragAfter={false}
                canReorder={false}
                canReparent={false}
                onToggleExpand={() => {}}
                onClick={() => {}}
                onDragStart={() => {}}
                onDragOver={() => {}}
                onDragEnd={() => {}}
              />
            </tbody>
          </table>
        </I18nProvider>
      </QueryClientProvider>
    )
    expect(screen.getAllByText('Unknown')).toHaveLength(2)
    expect(screen.queryByText('cls_7')).not.toBeInTheDocument()
    expect(screen.queryByText('usr_3')).not.toBeInTheDocument()
  })

  // Matches the header: the handle and the first content column stay put, and
  // everything after them scrolls.
  it('pins the handle and first content cells', () => {
    const { container } = render(
      <QueryClientProvider client={new QueryClient()}>
        <I18nProvider i18n={i18n}>
          <table>
            <tbody>
              <TreeRow
                object={{ id: 'o1', class: 'c', values: { title: 'A' } }}
                depth={0}
                hasChildren={false}
                isExpanded={false}
                anySiblingHasChildren={false}
                fields={[
                  { id: 'title', name: 'Title', fieldtype: 'text' },
                  { id: 'due', name: 'Due', fieldtype: 'date' },
                ]}
                options={{}}
                peopleMap={{}}
                classMap={{}}
                titleFieldId='title'
                showId={false}
                isDragOver={false}
                isDragBefore={false}
                isDragAfter={false}
                canReorder={false}
                canReparent={false}
                onToggleExpand={() => {}}
                onClick={() => {}}
                onDragStart={() => {}}
                onDragOver={() => {}}
                onDragEnd={() => {}}
              />
            </tbody>
          </table>
        </I18nProvider>
      </QueryClientProvider>
    )
    const cells = container.querySelectorAll('td')
    expect(cells[0]).toHaveClass('sticky', 'start-0')
    expect(cells[1]).toHaveClass('sticky', 'start-10')
    expect(cells[2]).not.toHaveClass('sticky')
    expect(cells[2]).toHaveClass('min-w-[15rem]')
  })
})
