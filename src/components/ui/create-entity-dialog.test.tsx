// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: Apache-2.0

import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { I18nProvider } from '@lingui/react'
import { i18n } from '@lingui/core'
import { CreateEntityDialog, DISALLOWED_NAME_CHARS } from './create-entity-dialog'

function show() {
  const onSubmit = vi.fn(async (_values: { name: string }) => {})
  render(
    <I18nProvider i18n={i18n}>
      <CreateEntityDialog open onOpenChange={() => {}} title='Create wiki' entityLabel='wiki' onSubmit={onSubmit} hideTrigger />
    </I18nProvider>
  )
  return onSubmit
}

describe('CreateEntityDialog', () => {
  it('accepts every name the server accepts, apostrophes included', async () => {
    const onSubmit = show()
    fireEvent.change(screen.getByRole('textbox'), { target: { value: "Ada's notes; \\ `quoted`" } })
    const create = screen.getByRole('button', { name: 'Create wiki' })
    await waitFor(() => expect(create).toBeEnabled())
    fireEvent.click(create)
    await waitFor(() => expect(onSubmit).toHaveBeenCalled())
    expect(onSubmit.mock.calls[0][0]).toMatchObject({ name: "Ada's notes; \\ `quoted`" })
  })

  it('refuses the two characters the server refuses', async () => {
    const onSubmit = show()
    const box = screen.getByRole('textbox')
    const create = screen.getByRole('button', { name: 'Create wiki' })
    fireEvent.change(box, { target: { value: 'fine' } })
    await waitFor(() => expect(create).toBeEnabled())
    fireEvent.change(box, { target: { value: '<b>' } })
    await waitFor(() => expect(create).toBeDisabled())
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('shares the pattern the app settings pages check', () => {
    expect(DISALLOWED_NAME_CHARS.test("it's")).toBe(false)
    expect(DISALLOWED_NAME_CHARS.test('a<b')).toBe(true)
  })

  it('interpolates the entity label as given, never re-cased', () => {
    render(
      <I18nProvider i18n={i18n}>
        <CreateEntityDialog open onOpenChange={() => {}} title='Neu' entityLabel='Wiki' showPrivacyToggle onSubmit={vi.fn()} hideTrigger />
      </I18nProvider>
    )
    expect(screen.getByRole('button', { name: 'Create Wiki' })).toBeInTheDocument()
    expect(screen.getByText('Allow anyone to search for Wiki')).toBeInTheDocument()
  })
})
