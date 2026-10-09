// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: Apache-2.0

import { useRef, useState } from 'react'
import { useLingui } from '@lingui/react/macro'
import type {
  NotificationCategory,
  NotificationTopic,
} from '../components/notification-category-button'
import { getErrorMessage } from '../lib/handle-server-error'
import { toast } from '../lib/toast-utils'

export interface NotificationCategoryPickerSource {
  listCategories: () => Promise<NotificationCategory[]>
  lookupTopic: (
    app: string,
    topic: string,
    object: string
  ) => Promise<NotificationTopic | null>
  setTopicCategory: (
    topic: NotificationTopic,
    category: string
  ) => Promise<void>
}

/**
 * State for NotificationCategoryButton. The consumer supplies the requests:
 * this library cannot read the notifications service on an app's behalf. One
 * picker is open at a time, so a single slot of state serves every row.
 */
export function useNotificationCategoryPicker(
  source: NotificationCategoryPickerSource
) {
  const { t } = useLingui()
  const [openKey, setOpenKey] = useState<string | null>(null)
  const [categories, setCategories] = useState<NotificationCategory[] | null>(
    null
  )
  const [topic, setTopic] = useState<NotificationTopic | null>(null)
  const [saving, setSaving] = useState(false)
  // The row the picker was last opened on. An answer for any other row is
  // dropped: stored, it would have the open picker save to that row's topic.
  const requested = useRef<string | null>(null)

  const keyFor = (app: string, topicName: string, object: string) =>
    `${app} ${topicName} ${object}`

  const open = async (app: string, topicName: string, object: string) => {
    const key = keyFor(app, topicName, object)
    requested.current = key
    setOpenKey(key)
    setCategories(null)
    setTopic(null)
    try {
      const [loadedCategories, row] = await Promise.all([
        source.listCategories(),
        source.lookupTopic(app, topicName, object),
      ])
      if (requested.current !== key) return
      setCategories(loadedCategories)
      setTopic(row)
    } catch (error) {
      if (requested.current !== key) return
      setCategories([])
      toast.error(
        getErrorMessage(error, t`Failed to load notification categories`)
      )
    }
  }

  const close = () => {
    requested.current = null
    setOpenKey(null)
    setCategories(null)
    setTopic(null)
  }

  const changeCategory = async (row: NotificationTopic, category: string) => {
    setSaving(true)
    try {
      await source.setTopicCategory(row, category)
      setTopic({ ...row, category })
      const topicLabel = row.label || row.topic
      const chosen = categories?.find((c) => String(c.id) === category)
      const categoryLabel = chosen ? (chosen.display ?? chosen.label) : null
      toast.success(
        categoryLabel
          ? t`${topicLabel} moved to the ${categoryLabel} category`
          : t`Category updated`
      )
      close()
    } catch (error) {
      toast.error(getErrorMessage(error, t`Failed to update category`))
    } finally {
      setSaving(false)
    }
  }

  return {
    keyFor,
    openKey,
    categories,
    topic,
    saving,
    open,
    close,
    changeCategory,
  }
}
