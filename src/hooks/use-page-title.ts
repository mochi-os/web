// Copyright © 2026 Mochi OÜ
// SPDX-License-Identifier: Apache-2.0

import { useEffect } from 'react'
import { usePageTitleStore } from '../stores/page-title-store'

// Sets the page title in the store. The actual document.title is set by
// NotificationTitle component which combines the title with notification count.
export function usePageTitle(title: string) {
  const setTitle = usePageTitleStore((state) => state.setTitle)

  useEffect(() => {
    setTitle(title)
  }, [title, setTitle])
}
