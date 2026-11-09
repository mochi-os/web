// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: Apache-2.0

import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { I18nProvider } from '@lingui/react'
import { i18n } from '@lingui/core'
import {
  NotificationCategoryButton,
  type NotificationCategory,
  type NotificationTopic,
} from './notification-category-button'

// Ids are mochi.uid() text; only the two seeds are '0' and '1'. A numeric
// fixture would hide both halves of what these tests pin.
const QUIET = '019f4cd679b07874b79c9f946f575490'
const CATEGORIES: NotificationCategory[] = [
  { id: '0', label: 'No notifications', default: 0 },
  { id: QUIET, label: 'Quiet', default: 0 },
  { id: '1', label: 'Normal', default: 1 },
]

const TOPIC: NotificationTopic = {
  app: 'feeds',
  topic: 'post',
  object: 'abc',
  label: 'New posts',
  category: '1',
}

function renderButton(
  props: Partial<React.ComponentProps<typeof NotificationCategoryButton>> = {}
) {
  const onOpenChange = vi.fn()
  const onCategoryChange = vi.fn().mockResolvedValue(undefined)
  render(
    <I18nProvider i18n={i18n}>
      <NotificationCategoryButton
        categories={CATEGORIES}
        topic={TOPIC}
        open={false}
        onOpenChange={onOpenChange}
        onCategoryChange={onCategoryChange}
        {...props}
      />
    </I18nProvider>
  )
  return { onOpenChange, onCategoryChange }
}

describe('NotificationCategoryButton', () => {
  it('issues no request of its own', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch')
    renderButton({ open: true })

    // The whole point: a component shipped into every app's bundle must not
    // reach for another app's routes. Rendering it fetches nothing.
    expect(fetchSpy).not.toHaveBeenCalled()
    fetchSpy.mockRestore()
  })

  it('asks the consumer to load when opened', () => {
    const { onOpenChange } = renderButton()

    // Positive control: the trigger is present and wired, so the assertions
    // about what it does are about behaviour rather than a missing button.
    fireEvent.keyDown(screen.getByLabelText('Change notification category'), {
      key: 'Enter',
    })
    expect(onOpenChange).toHaveBeenCalledWith(true)
  })

  it('shows a placeholder while the consumer is still loading', () => {
    renderButton({ open: true, categories: null })
    expect(screen.queryByRole('menuitemradio')).not.toBeInTheDocument()
  })

  it('lists the categories in the menu itself, the current one checked', () => {
    // THE POINT: one menu, so a category is one choice away - no heading and
    // no dropdown inside it to open first.
    renderButton({ open: true })
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument()
    expect(
      screen.queryByText('Category for these notifications')
    ).not.toBeInTheDocument()
    expect(
      screen.getByRole('menuitemradio', { name: 'Normal' })
    ).toHaveAttribute('aria-checked', 'true')
    expect(
      screen.getByRole('menuitemradio', { name: 'Quiet' })
    ).toHaveAttribute('aria-checked', 'false')
  })

  it('explains itself when the topic row does not exist yet', () => {
    renderButton({ open: true, topic: null })
    expect(screen.getByText(/No topic record yet/)).toBeInTheDocument()
    expect(screen.queryByRole('menuitemradio')).not.toBeInTheDocument()
  })

  it('sorts the no-notifications category last', () => {
    // The id is the string '0', so the default-last rule has to compare it as
    // one: against the number 0 it never matched and the row sorted by name.
    renderButton({ open: true })
    const labels = screen
      .getAllByRole('menuitemradio')
      .map((item) => item.textContent)
    expect(labels).toEqual(['Normal', 'Quiet', 'No notifications'])
  })

  it('hands the consumer the category id verbatim', () => {
    // A uid is 32 hex characters. Anything that treats it as a number keeps
    // only the leading digit run, so the id must survive the round trip whole.
    const { onCategoryChange } = renderButton({ open: true })
    fireEvent.click(screen.getByRole('menuitemradio', { name: 'Quiet' }))
    expect(onCategoryChange).toHaveBeenCalledWith(TOPIC, QUIET)
  })

  it('offers no choice while a change is saving', () => {
    const { onCategoryChange } = renderButton({ open: true, saving: true })
    const quiet = screen.getByRole('menuitemradio', { name: 'Quiet' })
    expect(quiet).toHaveAttribute('aria-disabled', 'true')
    fireEvent.click(quiet)
    expect(onCategoryChange).not.toHaveBeenCalled()
  })

  it('links to the category editor in settings', () => {
    renderButton({ open: true })
    const link = screen.getByRole('menuitem', { name: 'Manage categories' })
    expect(link).toHaveAttribute('href', '/settings/user/notifications')
  })
})
