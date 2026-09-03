// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: Apache-2.0

import { describe, it, expect, vi } from 'vitest'
import { render, screen, createMockEntityField } from './entity-test-utils'
import { EditFieldDialog } from './entity-field-dialog'

describe('EditFieldDialog', () => {
  it('shows the type by its name, not the stored value', () => {
    render(
      <EditFieldDialog
        open
        onOpenChange={() => {}}
        field={createMockEntityField({ id: 'status', name: 'Status', fieldtype: 'enumerated' })}
        options={[]}
        onUpdate={vi.fn()}
        onDelete={vi.fn()}
        onAddOption={vi.fn()}
        onEditOption={vi.fn()}
        onDeleteOption={vi.fn()}
      />
    )
    expect(screen.getByText('Select')).toBeInTheDocument()
    expect(screen.queryByText('enumerated')).toBeNull()
    expect(screen.getByLabelText('Name')).toHaveAttribute('maxlength', '100')
  })
})
