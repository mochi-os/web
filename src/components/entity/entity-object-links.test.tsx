// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: Apache-2.0

import { describe, it, expect, vi } from 'vitest'
import { render, screen, createMockEntityClass } from './entity-test-utils'
import { EntityObjectLinks } from './entity-object-links'

describe('EntityObjectLinks', () => {
  it('lets a long title truncate instead of widening the panel', async () => {
    render(
      <EntityObjectLinks
        containerId='c1'
        objectId='o1'
        outgoing={[{ target: 'o2', linktype: 'relates', created: 1, title: 'A very long linked object title that does not fit' }]}
        incoming={[]}
        classes={[createMockEntityClass()]}
        readOnly={false}
        listObjects={vi.fn(async () => ({ data: { objects: [] } }))}
        createLink={vi.fn(async () => ({}))}
        deleteLink={vi.fn(async () => ({}))}
      />
    )
    const title = await screen.findByText(/A very long linked object title/)
    const row = title.parentElement as HTMLElement
    expect(row.className).toContain('min-w-0')
    const grid = row.closest('.grid') as HTMLElement
    expect(grid.className).toContain('grid-cols-[120px_minmax(0,1fr)]')
    const remove = row.querySelector('button') as HTMLElement
    expect(remove.className).toContain('[@media(hover:none)]:inline-flex')
  })
})
