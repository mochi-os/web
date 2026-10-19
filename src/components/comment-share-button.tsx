// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: Apache-2.0

import { Share2 } from 'lucide-react'
import { useLingui } from '@lingui/react/macro'
import { shellClipboardWrite } from '../lib/shell-bridge'
import { toast } from '../lib/toast-utils'
import { cn } from '../lib/utils'
import { Tooltip, TooltipContent, TooltipTrigger } from './ui/tooltip'

/**
 * Shares a link to one comment. A touch screen gets the system share sheet, as
 * in the Reddit app; a mouse copies the link. The share sheet falls back to
 * copying where the browser or the shell's iframe does not allow it.
 */
export function CommentShareButton({
  url,
  className,
}: {
  url: string
  className?: string
}) {
  const { t } = useLingui()

  const share = async () => {
    // eslint-disable-next-line lingui/no-unlocalized-strings -- media query
    const touch = window.matchMedia?.('(pointer: coarse)').matches
    if (touch && typeof navigator.share === 'function') {
      try {
        await navigator.share({ url })
        return
      } catch (error) {
        // Closing the sheet is not a failure, and needs no copy behind it.
        if (error instanceof DOMException && error.name === 'AbortError') return
      }
    }
    if (await shellClipboardWrite(url)) toast.success(t`Copied to clipboard`)
    else toast.error(t`Failed to copy`)
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type='button'
          aria-label={t`Share`}
          className={cn(className)}
          onClick={() => void share()}
        >
          <Share2 className='size-3.5' />
        </button>
      </TooltipTrigger>
      <TooltipContent>{t`Share`}</TooltipContent>
    </Tooltip>
  )
}
