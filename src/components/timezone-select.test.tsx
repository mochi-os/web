// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: Apache-2.0

import { describe, it, expect, vi, afterEach } from 'vitest'
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react'
import { I18nProvider } from '@lingui/react'
import { i18n } from '@lingui/core'
import { TimezoneSelect } from './timezone-select'
import { offsetLabel, seaTimezones, zoneCity } from '../lib/locale-format'

afterEach(() => cleanup())

function show(
  props: Partial<React.ComponentProps<typeof TimezoneSelect>> = {}
) {
  render(
    <I18nProvider i18n={i18n}>
      <TimezoneSelect value='Europe/London' onChange={vi.fn()} {...props} />
    </I18nProvider>
  )
  // The trigger, read before the list opens: the list's search box is a
  // combobox too.
  return screen.getByRole('combobox')
}

// A zone's land, the layer that shows, unless another layer is asked for.
const path = (zone: string, layer = 'land') =>
  waitFor(() => {
    const found = document.querySelector(
      `[data-layer="${layer}"][data-zone="${zone}"]`
    )
    if (!found) throw new Error('the map has not loaded')
    return found
  })

describe('TimezoneSelect', () => {
  it('shows the zone in full, and only its city when compact', () => {
    expect(show().textContent).toContain('Europe/London')
    cleanup()
    const trigger = show({ compact: true, label: 'Start time zone' })
    expect(trigger.getAttribute('aria-label')).toBe('Start time zone')
    expect(trigger.textContent).toBe('London')
  })

  it('offers the browser zone for a preference and not for an event', async () => {
    fireEvent.click(show())
    expect(await screen.findByText(/Detect from web browser/)).toBeTruthy()
    cleanup()
    fireEvent.click(show({ auto: false }))
    await screen.findByPlaceholderText('Search time zone...')
    expect(screen.queryByText(/Detect from web browser/)).toBeNull()
  })

  it('draws the map with the chosen zone filled and chooses a zone clicked on it', async () => {
    const onChange = vi.fn()
    fireEvent.click(show({ onChange }))
    const london = await path('Europe/London')
    expect(london.getAttribute('class')).toContain('fill-primary')
    const newYork = await path('America/New_York')
    expect(newYork.getAttribute('class')).not.toContain('fill-primary')
    fireEvent.pointerEnter(newYork)
    expect(screen.getByTestId('timezone-pointed').textContent).toContain(
      'New York'
    )
    fireEvent.click(newYork)
    expect(onChange).toHaveBeenCalledWith('America/New_York')
  })

  it('names the data source inside the map', async () => {
    fireEvent.click(show())
    await path('Europe/London')
    const notice = screen.getByText('© OpenStreetMap contributors')
    expect(
      notice.parentElement?.querySelector('[data-testid="timezone-map"]')
    ).toBeTruthy()
  })

  it('draws the sea bands, then each zone whole and invisible, then its land on top', async () => {
    const onChange = vi.fn()
    fireEvent.click(show({ onChange }))
    const band = await path('Etc/GMT', 'sea')
    const whole = await path('Asia/Jakarta', 'zone')
    const land = await path('Asia/Jakarta', 'land')
    expect(
      band.compareDocumentPosition(whole) & Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy()
    expect(
      whole.compareDocumentPosition(land) & Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy()
    // The whole zone catches a click in its waters without painting them.
    expect(whole.getAttribute('class')).toContain('fill-transparent')
    expect(land.getAttribute('class')).not.toContain('fill-transparent')
    fireEvent.click(whole)
    expect(onChange).toHaveBeenCalledWith('Asia/Jakarta')
  })

  it('chooses a sea band clicked on the open sea', async () => {
    const onChange = vi.fn()
    fireEvent.click(show({ onChange }))
    fireEvent.click(await path('Etc/GMT', 'sea'))
    expect(onChange).toHaveBeenCalledWith('Etc/GMT')
  })

  it('tints the pointed zone on every layer it has', async () => {
    fireEvent.click(show())
    const whole = await path('Asia/Jakarta', 'zone')
    fireEvent.pointerEnter(whole)
    expect(
      (await path('Asia/Jakarta', 'land')).getAttribute('class')
    ).toContain('fill-primary/35')
    expect(whole.getAttribute('class')).toContain('fill-primary/35')
  })
})

describe('the list', () => {
  it('shows each zone with its offset, and the sea zones in a group of their own', async () => {
    fireEvent.click(show())
    const tokyo = await screen.findByText('Asia/Tokyo')
    expect(tokyo.parentElement?.textContent).toContain('UTC+9')
    // A sea zone reads as the offset it is, not as the zone database's
    // inverted name.
    const sea = screen.getByText('At sea').closest('[cmdk-group]')!
    expect(sea.textContent).toContain('UTC-5')
    expect(sea.textContent).toContain('UTC+12')
    expect(sea.textContent).not.toContain('Etc/GMT')
  })

  it('names a chosen sea zone the same way on the button', () => {
    render(
      <I18nProvider i18n={i18n}>
        <TimezoneSelect value='Etc/GMT-8' onChange={vi.fn()} auto={false} />
      </I18nProvider>
    )
    expect(screen.getByRole('combobox').textContent).toContain('UTC+8')
    expect(screen.getByRole('combobox').textContent).not.toContain('Etc')
  })

  it('names a sea zone by its offset from UTC, the sign read the right way round', () => {
    expect(zoneCity('Etc/GMT-8')).toBe('UTC+8')
    expect(zoneCity('Etc/GMT+10')).toBe('UTC-10')
    expect(zoneCity('Etc/GMT')).toBe('UTC')
    expect(zoneCity('Etc/GMT-1')).toBe('UTC+1')
    expect(zoneCity('Etc/GMT+0')).toBe('UTC')
    expect(zoneCity('America/New_York')).toBe('New York')
    expect(zoneCity('UTC')).toBe('UTC')
  })

  it('names the sea zones the way the zone database does', () => {
    const sea = seaTimezones()
    expect(sea).toHaveLength(25)
    expect(sea[0]).toBe('Etc/GMT+12')
    expect(sea[12]).toBe('Etc/GMT')
    expect(sea[24]).toBe('Etc/GMT-12')
    expect(offsetLabel('Etc/GMT+12')).toBe('UTC-12')
  })
})

describe('offsetLabel', () => {
  const winter = new Date(Date.UTC(2026, 0, 15, 12))
  const summer = new Date(Date.UTC(2026, 6, 15, 12))
  it('reads a zone at an instant', () => {
    expect(offsetLabel('Europe/London', winter)).toBe('UTC')
    expect(offsetLabel('Europe/London', summer)).toBe('UTC+1')
    expect(offsetLabel('Asia/Kolkata', winter)).toBe('UTC+5:30')
    expect(offsetLabel('America/New_York', winter)).toBe('UTC-5')
  })
  it('is empty for a zone the browser does not know', () => {
    expect(offsetLabel('Nowhere/Invalid')).toBe('')
  })
})
