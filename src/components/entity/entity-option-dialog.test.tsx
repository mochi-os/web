// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: Apache-2.0

import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, createMockEntityOption } from './entity-test-utils'
import { EntityOptionDialog } from './entity-option-dialog'

describe('EntityOptionDialog', () => {
  it('will not save an option whose name was cleared', () => {
    const onUpdate = vi.fn()
    render(
      <EntityOptionDialog open onOpenChange={() => {}} option={createMockEntityOption({ name: 'Todo' })} onUpdate={onUpdate} />
    )
    const name = screen.getByLabelText('Name')
    expect(name).toHaveAttribute('maxlength', '100')
    expect(screen.getByRole('button', { name: 'Save' })).toBeEnabled()
    fireEvent.change(name, { target: { value: '   ' } })
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled()
    expect(onUpdate).not.toHaveBeenCalled()
  })
})
