// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: Apache-2.0

import { describe, it, expect, vi, beforeAll, afterEach } from 'vitest'
import { cleanup, render, screen, fireEvent } from '@testing-library/react'
import { I18nProvider } from '@lingui/react'
import { i18n } from '@lingui/core'
import { TimePicker } from './time-picker'

// The clock the user chose; the provider's default is the 24-hour one.
let clock: '12h' | '24h' = '24h'

vi.mock('../../context/locale-provider', async (importOriginal) => {
  const original =
    await importOriginal<typeof import('../../context/locale-provider')>()
  return {
    ...original,
    useLocale: () => {
      const value = original.useLocale()
      return { ...value, locale: { ...value.locale, timeFormat: clock } }
    },
  }
})

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

afterEach(() => {
  cleanup()
  clock = '24h'
})

function show(value: number) {
  const onChange = vi.fn()
  render(
    <I18nProvider i18n={i18n}>
      <TimePicker value={value} onChange={onChange} aria-label='Start time' />
    </I18nProvider>
  )
  const input = screen.getByRole('textbox', { name: 'Start time' })
  const open = () => fireEvent.click(screen.getByLabelText('Choose a time'))
  return { onChange, input: input as HTMLInputElement, open }
}

const hours = () =>
  Array.from(document.querySelectorAll('[data-hour]')).map(
    (button) => button.textContent
  )
const minutes = () =>
  Array.from(document.querySelectorAll('[data-minute]')).map(
    (button) => button.textContent
  )
const pressed = (selector: string) =>
  document.querySelector(selector)?.getAttribute('aria-pressed')

describe('TimePicker', () => {
  it("shows the time on the user's clock", () => {
    expect(show(21 * 60 + 5).input.value).toBe('21:05')
    cleanup()
    clock = '12h'
    expect(show(21 * 60 + 5).input.value).toMatch(/^9:05\s?PM$/i)
  })

  it('offers every hour at once and the minutes in five-minute steps', () => {
    const { open } = show(9 * 60 + 30)
    open()
    expect(hours()).toHaveLength(24)
    expect(hours()[0]).toBe('00')
    expect(hours()[23]).toBe('23')
    expect(minutes()).toEqual([
      '00',
      '05',
      '10',
      '15',
      '20',
      '25',
      '30',
      '35',
      '40',
      '45',
      '50',
      '55',
    ])
    expect(pressed('[data-hour="9"]')).toBe('true')
    expect(pressed('[data-minute="30"]')).toBe('true')
  })

  it('puts the hours in a morning and an afternoon row on a 12-hour clock', () => {
    clock = '12h'
    const { open } = show(14 * 60)
    open()
    expect(hours()).toEqual([
      '12',
      '1',
      '2',
      '3',
      '4',
      '5',
      '6',
      '7',
      '8',
      '9',
      '10',
      '11',
      '12',
      '1',
      '2',
      '3',
      '4',
      '5',
      '6',
      '7',
      '8',
      '9',
      '10',
      '11',
    ])
    expect(screen.getByText(/^AM$/i)).toBeTruthy()
    expect(screen.getByText(/^PM$/i)).toBeTruthy()
    expect(pressed('[data-hour="14"]')).toBe('true')
  })

  it('sets the hour keeping the minutes and stays open, then closes on a minute', () => {
    const { open, onChange } = show(9 * 60 + 30)
    open()
    fireEvent.click(document.querySelector('[data-hour="14"]')!)
    expect(onChange).toHaveBeenLastCalledWith(14 * 60 + 30)
    expect(document.querySelector('[data-minute]')).toBeTruthy()
    fireEvent.click(document.querySelector('[data-minute="45"]')!)
    expect(onChange).toHaveBeenLastCalledWith(9 * 60 + 45)
    expect(document.querySelector('[data-minute]')).toBeNull()
  })

  it('shows every minute from the caret and hides them again, opening on them for a time off the steps', () => {
    const { open } = show(9 * 60 + 30)
    open()
    const caret = screen.getByLabelText('Every minute')
    expect(caret.getAttribute('aria-expanded')).toBe('false')
    fireEvent.click(caret)
    expect(minutes()).toHaveLength(60)
    expect(caret.getAttribute('aria-expanded')).toBe('true')
    fireEvent.click(caret)
    expect(minutes()).toHaveLength(12)
    cleanup()
    show(9 * 60 + 37).open()
    expect(minutes()).toHaveLength(60)
    expect(pressed('[data-minute="37"]')).toBe('true')
    expect(
      screen.getByLabelText('Every minute').getAttribute('aria-expanded')
    ).toBe('true')
  })

  it('reads a typed time when the field is left, and marks text that is not one', () => {
    const { input, onChange } = show(9 * 60)
    fireEvent.focus(input)
    fireEvent.change(input, { target: { value: '1' } })
    expect(onChange).not.toHaveBeenCalled()
    fireEvent.change(input, { target: { value: '1430' } })
    fireEvent.blur(input)
    expect(onChange).toHaveBeenLastCalledWith(14 * 60 + 30)
    expect(input.value).toBe('14:30')
    fireEvent.focus(input)
    fireEvent.change(input, { target: { value: 'soon' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(input.getAttribute('aria-invalid')).toBe('true')
    expect(onChange).toHaveBeenCalledTimes(1)
  })

  it('moves along a grid with the arrow keys', () => {
    const { open } = show(9 * 60)
    open()
    const nine = document.querySelector<HTMLButtonElement>('[data-hour="9"]')!
    nine.focus()
    fireEvent.keyDown(nine, { key: 'ArrowRight' })
    expect(document.activeElement?.getAttribute('data-hour')).toBe('10')
    fireEvent.keyDown(document.activeElement!, { key: 'ArrowDown' })
    expect(document.activeElement?.getAttribute('data-hour')).toBe('16')
  })
})
