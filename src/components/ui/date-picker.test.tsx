// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: Apache-2.0

import { describe, it, expect, vi, beforeAll } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { I18nProvider } from '@lingui/react'
import { i18n } from '@lingui/core'
import { DatePicker } from './date-picker'

beforeAll(() => {
  i18n.load('en', {})
  i18n.activate('en')
  if (!globalThis.ResizeObserver) {
    globalThis.ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    } as unknown as typeof ResizeObserver
  }
})

// Without a LocaleProvider the date format is the ISO default, YYYY-MM-DD.
function show(value: string) {
  const onChange = vi.fn()
  const onInvalid = vi.fn()
  render(
    <I18nProvider i18n={i18n}>
      <DatePicker
        value={value}
        onChange={onChange}
        onInvalid={onInvalid}
        aria-label='Birthday'
      />
    </I18nProvider>
  )
  return { onChange, onInvalid, input: screen.getByRole('textbox', { name: 'Birthday' }) }
}

describe('DatePicker', () => {
  it('shows the day in the user\'s format', () => {
    const { input } = show('2026-09-22')
    expect((input as HTMLInputElement).value).toBe('2026-09-22')
  })

  it('reports a typed day as soon as it is complete, and not before', () => {
    const { input, onChange, onInvalid } = show('')
    fireEvent.focus(input)
    fireEvent.change(input, { target: { value: '2026-09-2' } })
    expect(onChange).not.toHaveBeenCalled()
    expect(input.getAttribute('aria-invalid')).toBeNull()
    fireEvent.change(input, { target: { value: '2026-09-22' } })
    expect(onChange).toHaveBeenLastCalledWith('2026-09-22')
    expect(onInvalid).toHaveBeenLastCalledWith(false)
  })

  it('marks text that is not a day when the field is left, and keeps the value', () => {
    const { input, onChange, onInvalid } = show('2026-09-22')
    fireEvent.focus(input)
    fireEvent.change(input, { target: { value: 'next tuesday' } })
    expect(input.getAttribute('aria-invalid')).toBeNull()
    fireEvent.blur(input)
    expect(input.getAttribute('aria-invalid')).toBe('true')
    expect(onInvalid).toHaveBeenLastCalledWith(true)
    expect(onChange).not.toHaveBeenCalled()
  })

  it('clears the value when the text is emptied', () => {
    const { input, onChange } = show('2026-09-22')
    fireEvent.focus(input)
    fireEvent.change(input, { target: { value: '' } })
    expect(onChange).toHaveBeenLastCalledWith('')
  })

  it('follows a value changed underneath while not being typed', () => {
    const onChange = vi.fn()
    const { rerender } = render(
      <I18nProvider i18n={i18n}>
        <DatePicker value='2026-09-22' onChange={onChange} aria-label='Birthday' />
      </I18nProvider>
    )
    rerender(
      <I18nProvider i18n={i18n}>
        <DatePicker value='2027-01-05' onChange={onChange} aria-label='Birthday' />
      </I18nProvider>
    )
    expect((screen.getByRole('textbox') as HTMLInputElement).value).toBe('2027-01-05')
  })

  it('opens a month grid whose header steps months and years, and picks a day from it', async () => {
    const { onChange } = show('2026-09-22')
    fireEvent.click(screen.getByRole('button', { name: 'Choose a date' }))
    expect(await screen.findByRole('button', { name: 'September' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Next year' })).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: '15' }))
    expect(onChange).toHaveBeenLastCalledWith('2026-09-15')
    await waitFor(() =>
      expect(screen.queryByRole('button', { name: 'September' })).toBeNull()
    )
  })
})
