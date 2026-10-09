// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: Apache-2.0

import type { ReactNode } from 'react'
import { i18n } from '@lingui/core'
import { I18nProvider } from '@lingui/react'
import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type {
  NotificationCategory,
  NotificationTopic,
} from '../components/notification-category-button'

const success = vi.fn()
const failure = vi.fn()

vi.mock('../lib/toast-utils', () => ({
  toast: {
    success: (...args: unknown[]) => success(...args),
    error: (...args: unknown[]) => failure(...args),
  },
}))

import { useNotificationCategoryPicker } from './use-notification-category-picker'

const categories: NotificationCategory[] = [
  { id: '0', label: 'No notifications', default: 0 },
  { id: '1', label: 'Normal', default: 1 },
]

const row = (object: string): NotificationTopic => ({
  app: 'chat',
  topic: 'message',
  object,
  label: `Chat ${object}`,
  category: '1',
})

// A lookup the test settles by hand, so two rows can answer out of order.
function deferredLookups() {
  const pending = new Map<string, (topic: NotificationTopic | null) => void>()
  const lookupTopic = vi.fn(
    (_app: string, _topic: string, object: string) =>
      new Promise<NotificationTopic | null>((resolve) => {
        pending.set(object, resolve)
      })
  )
  return {
    lookupTopic,
    answer: (object: string) => pending.get(object)!(row(object)),
  }
}

function mount(source: {
  listCategories?: () => Promise<NotificationCategory[]>
  lookupTopic: (
    app: string,
    topic: string,
    object: string
  ) => Promise<NotificationTopic | null>
  setTopicCategory?: (
    topic: NotificationTopic,
    category: string
  ) => Promise<void>
}) {
  return renderHook(
    () =>
      useNotificationCategoryPicker({
        listCategories: async () => categories,
        setTopicCategory: async () => {},
        ...source,
      }),
    {
      wrapper: ({ children }: { children: ReactNode }) => (
        <I18nProvider i18n={i18n}>{children}</I18nProvider>
      ),
    }
  )
}

describe('useNotificationCategoryPicker', () => {
  beforeEach(() => {
    i18n.loadAndActivate({ locale: 'en', messages: {} })
    success.mockClear()
    failure.mockClear()
  })

  it('keeps the topic of the row that is open when an earlier row answers last', async () => {
    const { lookupTopic, answer } = deferredLookups()
    const { result } = mount({ lookupTopic })

    await act(async () => {
      void result.current.open('chat', 'message', 'a')
      void result.current.open('chat', 'message', 'b')
    })
    await act(async () => answer('b'))
    await act(async () => answer('a'))

    expect(result.current.openKey).toBe('chat message b')
    expect(result.current.topic?.object).toBe('b')
  })

  it('stores nothing when the picker closes before the answer', async () => {
    const { lookupTopic, answer } = deferredLookups()
    const { result } = mount({ lookupTopic })

    await act(async () => {
      void result.current.open('chat', 'message', 'a')
    })
    act(() => result.current.close())
    await act(async () => answer('a'))

    expect(result.current.topic).toBeNull()
    expect(result.current.categories).toBeNull()
  })

  it('reports a failed load and leaves an empty category list', async () => {
    const { result } = mount({
      lookupTopic: async () => {
        throw new Error('offline')
      },
    })

    await act(async () => {
      await result.current.open('chat', 'message', 'a')
    })

    expect(result.current.categories).toEqual([])
    expect(failure).toHaveBeenCalledTimes(1)
  })

  it('saves the chosen category to the topic it was given, then closes', async () => {
    const setTopicCategory = vi.fn(async () => {})
    const { result } = mount({
      lookupTopic: async (_app, _topic, object) => row(object),
      setTopicCategory,
    })

    await act(async () => {
      await result.current.open('chat', 'message', 'a')
    })
    await act(async () => {
      await result.current.changeCategory(row('a'), '0')
    })

    expect(setTopicCategory).toHaveBeenCalledWith(row('a'), '0')
    expect(success).toHaveBeenCalledWith(
      'Chat a moved to the No notifications category'
    )
    expect(result.current.openKey).toBeNull()
  })
})
