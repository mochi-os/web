// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: Apache-2.0

import { describe, it, expect, vi, beforeAll } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { I18nProvider } from '@lingui/react'
import { i18n } from '@lingui/core'
import { DateHeader } from './date-header'

beforeAll(() => {
  i18n.load('en', {})
  i18n.activate('en')
  // Radix positions a popover with ResizeObserver, which jsdom lacks.
  if (!globalThis.ResizeObserver) {
    globalThis.ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    } as unknown as typeof ResizeObserver
  }
})

function show(month: number, year: number) {
  const onChange = vi.fn()
  render(
    <I18nProvider i18n={i18n}>
      <DateHeader month={month} year={year} onChange={onChange} />
    </I18nProvider>
  )
  return onChange
}

describe('DateHeader', () => {
  it('shows the month name and the year as their own boxes', () => {
    show(9, 2026)
    expect(screen.getByRole('button', { name: 'September' })).toBeTruthy()
    expect(screen.getByRole('button', { name: '2026' })).toBeTruthy()
  })

  it('rolls the month chevrons over the year at either end', () => {
    const onChange = show(1, 2026)
    fireEvent.click(screen.getByRole('button', { name: 'Previous month' }))
    expect(onChange).toHaveBeenLastCalledWith(2025, 12)
    fireEvent.click(screen.getByRole('button', { name: 'Next month' }))
    expect(onChange).toHaveBeenLastCalledWith(2026, 2)
  })

  it('rolls December forward into January of the next year', () => {
    const onChange = show(12, 2026)
    fireEvent.click(screen.getByRole('button', { name: 'Next month' }))
    expect(onChange).toHaveBeenLastCalledWith(2027, 1)
  })

  it('keeps the month when the year chevrons step', () => {
    const onChange = show(12, 2026)
    fireEvent.click(screen.getByRole('button', { name: 'Previous year' }))
    expect(onChange).toHaveBeenLastCalledWith(2025, 12)
    fireEvent.click(screen.getByRole('button', { name: 'Next year' }))
    expect(onChange).toHaveBeenLastCalledWith(2027, 12)
  })

  it('offers the twelve months when the month is clicked', async () => {
    const onChange = show(9, 2026)
    fireEvent.click(screen.getByRole('button', { name: 'September' }))
    const list = await screen.findByRole('listbox', { name: 'Month' })
    expect(list.querySelectorAll('[role=option]')).toHaveLength(12)
    // The shown month is tinted in the primary colour; the others are not.
    expect(
      screen
        .getByRole('option', { name: 'September' })
        .classList.contains('bg-primary/10')
    ).toBe(true)
    expect(
      screen
        .getByRole('option', { name: 'March' })
        .classList.contains('bg-primary/10')
    ).toBe(false)
    fireEvent.click(screen.getByRole('option', { name: 'March' }))
    expect(onChange).toHaveBeenLastCalledWith(2026, 3)
    await waitFor(() =>
      expect(screen.queryByRole('listbox', { name: 'Month' })).toBeNull()
    )
  })

  it('offers years around the shown one when the year is clicked', async () => {
    const onChange = show(9, 2026)
    fireEvent.click(screen.getByRole('button', { name: '2026' }))
    const list = await screen.findByRole('listbox', { name: 'Year' })
    const years = [...list.querySelectorAll('[role=option]')].map(
      (o) => o.textContent
    )
    expect(years[0]).toBe('1986')
    expect(years[years.length - 1]).toBe('2066')
    expect(
      screen.getByRole('option', { name: '2026', selected: true })
    ).toBeTruthy()
    expect(
      screen
        .getByRole('option', { name: '2026' })
        .classList.contains('bg-primary/10')
    ).toBe(true)
    expect(
      screen
        .getByRole('option', { name: '2030' })
        .classList.contains('bg-primary/10')
    ).toBe(false)
    fireEvent.click(screen.getByRole('option', { name: '2030' }))
    expect(onChange).toHaveBeenLastCalledWith(2030, 9)
  })

  it('grows the year list whichever way it is scrolled', async () => {
    show(9, 2026)
    fireEvent.click(screen.getByRole('button', { name: '2026' }))
    const list = await screen.findByRole('listbox', { name: 'Year' })
    const count = () => list.querySelectorAll('[role=option]').length
    expect(count()).toBe(81)
    Object.defineProperty(list, 'scrollHeight', {
      value: 81 * 28,
      configurable: true,
    })
    Object.defineProperty(list, 'clientHeight', {
      value: 224,
      configurable: true,
    })
    list.scrollTop = 0
    fireEvent.scroll(list)
    await waitFor(() => expect(count()).toBe(121))
    expect(list.querySelector('[role=option]')?.textContent).toBe('1946')
    Object.defineProperty(list, 'scrollHeight', {
      value: 121 * 28,
      configurable: true,
    })
    list.scrollTop = 121 * 28 - 224
    fireEvent.scroll(list)
    await waitFor(() => expect(count()).toBe(161))
    const options = list.querySelectorAll('[role=option]')
    expect(options[options.length - 1].textContent).toBe('2106')
  })
})
