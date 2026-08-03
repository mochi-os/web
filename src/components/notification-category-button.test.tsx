// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: Apache-2.0

// This component used to fetch the menu app's routes with the consuming app's
// token, which core refuses (app_token_mismatch), so on every page but the
// menu's own the picker silently never loaded. It now takes its data, which is
// what makes "the picker populates" assertable at all.

import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { I18nProvider } from '@lingui/react'
import { i18n } from '@lingui/core'
import {
  NotificationCategoryButton,
  type NotificationCategory,
  type NotificationTopic,
} from './notification-category-button'

const CATEGORIES: NotificationCategory[] = [
  { id: 0, label: 'No notifications', default: 0 },
  { id: 2, label: 'Quiet', default: 0 },
  { id: 1, label: 'Normal', default: 1 },
]

const TOPIC: NotificationTopic = {
  app: 'feeds',
  topic: 'post',
  object: 'abc',
  label: 'New posts',
  category: 1,
}

function renderButton(props: Partial<React.ComponentProps<typeof NotificationCategoryButton>> = {}) {
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
    fireEvent.click(screen.getByLabelText('Change notification category'))
    expect(onOpenChange).toHaveBeenCalledWith(true)
  })

  it('shows a placeholder while the consumer is still loading', () => {
    renderButton({ open: true, categories: null })
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument()
  })

  it('populates the picker from the supplied categories', async () => {
    renderButton({ open: true })
    // The select shows the topic's current category.
    expect(await screen.findByRole('combobox')).toHaveTextContent('Normal')
  })

  it('explains itself when the topic row does not exist yet', () => {
    renderButton({ open: true, topic: null })
    expect(screen.getByText(/No topic record yet/)).toBeInTheDocument()
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument()
  })
})
