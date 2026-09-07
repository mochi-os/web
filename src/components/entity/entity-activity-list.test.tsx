// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: Apache-2.0

import { describe, it, expect, vi } from 'vitest'
import { render, screen, createMockEntityField } from './entity-test-utils'
import { EntityActivityList } from './entity-activity-list'

const activities = [
  { id: 'a1', user: 'u1', name: 'Ada', action: 'update', field: 'due_date', oldvalue: '1', newvalue: '2', created: 1 },
  { id: 'a2', user: 'u1', name: 'Ada', action: 'create', field: '', oldvalue: '', newvalue: '', created: 2 },
  { id: 'a3', user: 'u1', name: 'Ada', action: 'update', field: 'gone', oldvalue: '', newvalue: '', created: 3 },
]

describe('EntityActivityList', () => {
  it('names the field from the design and never shows its id', async () => {
    render(
      <EntityActivityList
        containerId='c1'
        objectId='o1'
        listActivity={vi.fn(async () => ({ data: { activities } }))}
        fields={[createMockEntityField({ id: 'due_date', name: 'Due date' })]}
      />
    )
    expect(await screen.findByText(/^Updated Due date/)).toBeInTheDocument()
    expect(screen.getByText('Created')).toBeInTheDocument()
    // A field the design no longer has is not named by its id.
    expect(screen.queryByText(/due_date/)).toBeNull()
    expect(screen.queryByText(/gone/)).toBeNull()
    expect(screen.getAllByText('Updated')).toHaveLength(1)
  })
})
