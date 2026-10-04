// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: Apache-2.0

import { afterEach, describe, it, expect, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { I18nProvider } from '@lingui/react'
import { i18n } from '@lingui/core'
import { MiniMonth } from './mini-month'

// The week start the format hook reports; the locale default is Monday.
const week = vi.hoisted(() => ({ start: 1 }))
vi.mock('../../hooks/use-format', async (importOriginal) => {
  const original =
    await importOriginal<typeof import('../../hooks/use-format')>()
  return {
    ...original,
    useFormat: () => ({ ...original.useFormat(), weekStartsOn: week.start }),
  }
})

function show(today: string) {
  const { container } = render(
    <I18nProvider i18n={i18n}>
      <MiniMonth selected='2026-09-22' today={today} onSelect={vi.fn()} />
    </I18nProvider>
  )
  return container.firstChild as HTMLElement
}

describe('MiniMonth', () => {
  it("colours today's number in the primary colour on a plain background", () => {
    show('2026-09-22')
    const today = screen.getByRole('button', { name: '22' })
    expect(today.classList.contains('text-primary')).toBe(true)
    expect(today.classList.contains('font-semibold')).toBe(true)
    expect(today.classList.contains('bg-primary')).toBe(false)
    expect(today.classList.contains('text-primary-foreground')).toBe(false)
  })

  it('leaves every other day in the plain text colour', () => {
    show('2026-09-22')
    for (const name of ['21', '23', '15']) {
      const day = screen.getByRole('button', { name })
      expect(day.classList.contains('text-primary')).toBe(false)
      expect(day.classList.contains('font-semibold')).toBe(false)
    }
  })

  it('shades no day at all', () => {
    show('2026-09-22')
    const days = screen
      .getAllByRole('button')
      .filter((button) => /^\d{1,2}$/.test(button.textContent ?? ''))
    expect(days).toHaveLength(42)
    const shaded = days.filter((day) =>
      [...day.classList].some((name) => name.startsWith('bg-'))
    )
    expect(shaded).toEqual([])
  })
})

describe('MiniMonth wheel', () => {
  it('moves to the next month on a wheel notch down', () => {
    fireEvent.wheel(show('2026-09-22'), { deltaY: 100 })
    expect(screen.getByRole('button', { name: 'October' })).toBeTruthy()
  })

  it('moves to the previous month on a wheel notch up', () => {
    fireEvent.wheel(show('2026-09-22'), { deltaY: -100 })
    expect(screen.getByRole('button', { name: 'August' })).toBeTruthy()
  })

  it('leaves the month alone while the year list scrolls', async () => {
    show('2026-09-22')
    fireEvent.click(screen.getByRole('button', { name: '2026' }))
    fireEvent.wheel(await screen.findByRole('option', { name: '2028' }), {
      deltaY: 100,
    })
    // The year list is modal, which hides the header from the tree.
    expect(
      screen.getByRole('button', { name: 'September', hidden: true })
    ).toBeTruthy()
  })

  it('leaves the month alone while the month list scrolls', async () => {
    show('2026-09-22')
    fireEvent.click(screen.getByRole('button', { name: 'September' }))
    fireEvent.wheel(await screen.findByRole('option', { name: 'March' }), {
      deltaY: 100,
    })
    expect(screen.getByRole('button', { name: 'September' })).toBeTruthy()
  })

  it('stays on a delta under the threshold', () => {
    fireEvent.wheel(show('2026-09-22'), { deltaY: 5 })
    expect(screen.getByRole('button', { name: 'September' })).toBeTruthy()
  })
})

describe('MiniMonth week numbers', () => {
  const numbers = () =>
    screen.getAllByTestId('week-number').map((label) => label.textContent)

  afterEach(() => {
    week.start = 1
  })

  function month(start: number) {
    week.start = start
    render(
      <I18nProvider i18n={i18n}>
        <MiniMonth
          selected='2026-10-15'
          today='2026-10-15'
          onSelect={vi.fn()}
        />
      </I18nProvider>
    )
  }

  it('names the ISO week most of a Sunday-first row is in', () => {
    // Sunday 4 to Saturday 10 October: Monday on is week 41.
    month(0)
    expect(numbers().slice(0, 2)).toEqual(['40', '41'])
  })

  it('names a Monday-first row by its own week, as before', () => {
    month(1)
    expect(numbers().slice(0, 2)).toEqual(['40', '41'])
  })
})
