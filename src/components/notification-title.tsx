// Copyright © 2026 Mochi OÜ
// SPDX-License-Identifier: Apache-2.0

import { useEffect } from 'react'
import { usePageTitleStore } from '../stores/page-title-store'
import { shellSetTitle } from '../lib/shell-bridge'

// Publishes the page title up to the shell, which combines it with the
// unread-notification count (sourced from the menu app) to set the browser
// tab title. Also sets document.title for direct-loaded apps.
// Place this component at the root of your app.
export function NotificationTitle() {
  const title = usePageTitleStore((state) => state.title)

  useEffect(() => {
    shellSetTitle(title || 'Mochi')
  }, [title])

  return null
}
