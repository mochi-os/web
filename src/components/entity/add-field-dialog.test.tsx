// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: Apache-2.0

import { describe, it, expect, vi } from 'vitest'
import { render, screen } from './entity-test-utils'
import { AddFieldDialog } from './add-field-dialog'

describe('AddFieldDialog', () => {
  it('caps the name where the server does and leads Add with the add glyph', () => {
    render(<AddFieldDialog open onOpenChange={() => {}} onAdd={vi.fn()} />)
    expect(screen.getByLabelText('Name')).toHaveAttribute('maxlength', '100')
    const add = screen.getByRole('button', { name: 'Add field' })
    expect(add.querySelector('svg.lucide-plus')).not.toBeNull()
    expect(add.querySelector('svg.lucide-check')).toBeNull()
  })
})
