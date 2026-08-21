// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: Apache-2.0

import { useCallback } from 'react'
import { useLingui } from '@lingui/react/macro'
import { getSendAttachmentErrorMessage } from '../lib/send-attachment-error'

/**
 * The message to show when a send carrying attachments is refused. The caller
 * passes the ordinary-case fallback, so it keeps its own wording.
 */
export function useAttachmentError() {
  const { t } = useLingui()

  return useCallback(
    (error: unknown, fallback: string): string =>
      getSendAttachmentErrorMessage(error, {
        fallback,
        tooLargeForServer: t`That was too large to upload. Remove or shrink files and try again.`,
        // A body the server cuts off mid-transfer surfaces in the browser as a
        // bare "Network Error", with nothing to say the size was the reason.
        networkMaybeTooLarge: t`That could not be sent. The files may be too large, or your connection failed. Try smaller files.`,
      }),
    [t]
  )
}
