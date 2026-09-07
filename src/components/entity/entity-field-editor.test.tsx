// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: Apache-2.0

import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, createMockEntityField } from './entity-test-utils'
import { EntityFieldEditor } from './entity-field-editor'

const searchUsers = vi.fn(async () => [])

function show(over: Record<string, unknown>) {
  const onChange = vi.fn()
  const onValidationError = vi.fn()
  render(
    <EntityFieldEditor
      field={createMockEntityField()}
      value=''
      options={[]}
      onChange={onChange}
      onValidationError={onValidationError}
      searchUsers={searchUsers}
      immediate
      {...over}
    />
  )
  return { onChange, onValidationError }
}

describe('EntityFieldEditor', () => {
  describe('checklist', () => {
    const field = createMockEntityField({ id: 'steps', name: 'Steps', fieldtype: 'checklist' })
    const value = JSON.stringify([{ id: 'a', text: 'Draft', done: false }])

    it('keeps typed item text local until the field is left', () => {
      const { onChange } = show({ field, value })
      const input = screen.getByDisplayValue('Draft')
      fireEvent.change(input, { target: { value: 'Drafting' } })
      fireEvent.change(input, { target: { value: 'Drafting now' } })
      expect(onChange).not.toHaveBeenCalled()
      fireEvent.blur(input)
      expect(onChange).toHaveBeenCalledTimes(1)
      expect(JSON.parse(onChange.mock.calls[0][0])[0].text).toBe('Drafting now')
    })

    it('commits on Enter as well', () => {
      const { onChange } = show({ field, value })
      const input = screen.getByDisplayValue('Draft')
      fireEvent.change(input, { target: { value: 'Done soon' } })
      fireEvent.keyDown(input, { key: 'Enter' })
      fireEvent.blur(input)
      expect(onChange).toHaveBeenCalledTimes(1)
    })

    it('shows the remove control where there is no hover', () => {
      show({ field, value })
      const remove = screen.getByRole('button', { name: 'Remove item' })
      expect(remove.className).toContain('[@media(hover:none)]:opacity-100')
    })
  })

  describe('text pattern', () => {
    const field = createMockEntityField({ id: 'code', name: 'Code', fieldtype: 'text', rows: 1, pattern: '^[A-Z]{3}$' })

    it('refuses a value the pattern rejects and says so', () => {
      const { onChange, onValidationError } = show({ field })
      const input = screen.getByRole('textbox')
      fireEvent.change(input, { target: { value: 'abcd' } })
      expect(onChange).not.toHaveBeenCalled()
      expect(onValidationError).toHaveBeenLastCalledWith(true)
      expect(screen.getByText('Does not match the required pattern')).toBeInTheDocument()
    })

    it('writes a value the pattern accepts and clears the error', () => {
      const { onChange, onValidationError } = show({ field })
      const input = screen.getByRole('textbox')
      fireEvent.change(input, { target: { value: 'abcd' } })
      fireEvent.change(input, { target: { value: 'ABC' } })
      expect(onChange).toHaveBeenCalledWith('ABC')
      expect(onValidationError).toHaveBeenLastCalledWith(false)
      expect(screen.queryByText('Does not match the required pattern')).toBeNull()
    })

    it('constrains nothing when the pattern does not compile', () => {
      const { onChange } = show({ field: { ...field, pattern: '[' } })
      fireEvent.change(screen.getByRole('textbox'), { target: { value: 'anything' } })
      expect(onChange).toHaveBeenCalledWith('anything')
    })
  })

  describe('number display', () => {
    it('groups the digits and keeps every decimal the value carries', () => {
      const field = createMockEntityField({ id: 'amount', name: 'Amount', fieldtype: 'number' })
      show({ field, value: '1234567.125', readOnly: true })
      expect(screen.getByText('1,234,567.125')).toBeInTheDocument()
    })
  })
})
