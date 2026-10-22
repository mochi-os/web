// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: Apache-2.0

import { Share2 } from 'lucide-react'
import { useLingui } from '@lingui/react/macro'
import { isInShell, shellClipboardWrite } from '../lib/shell-bridge'
import { toast } from '../lib/toast-utils'
import { cn } from '../lib/utils'
import { Tooltip, TooltipContent, TooltipTrigger } from './ui/tooltip'

/**
 * Shares a link to one comment. Outside the shell a touch screen gets the
 * system share sheet, as in the Reddit app, falling back to a copy where the
 * browser refuses it; a mouse copies the link. Inside the shell it always
 * copies.
 */
export function CommentShareButton({
  getUrl,
  className,
}: {
  /** Builds the link when pressed, not on every render of every comment. */
  getUrl: () => string
  className?: string
}) {
  const { t } = useLingui()

  const report = (ok: boolean) => {
    if (ok) toast.success(t`Copied to clipboard`)
    else toast.error(t`Failed to copy`)
  }

  const share = () => {
    const url = getUrl()
    // The shell's frame is not allowed web-share, so the sheet is always
    // refused there, and its copy only works inside the press itself: waiting
    // for the refusal first loses the press, and the copy fails. So inside
    // the shell copy straight away, before anything is awaited.
    const sheet =
      !isInShell() &&
      typeof navigator.share === 'function' &&
      // eslint-disable-next-line lingui/no-unlocalized-strings -- media query
      window.matchMedia?.('(pointer: coarse)').matches
    if (!sheet) {
      void shellClipboardWrite(url).then(report)
      return
    }
    navigator.share({ url }).catch((error: unknown) => {
      // Closing the sheet is not a failure, and needs no copy behind it.
      if (error instanceof DOMException && error.name === 'AbortError') return
      void shellClipboardWrite(url).then(report)
    })
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type='button'
          aria-label={t`Share`}
          className={cn(className)}
          onClick={share}
        >
          <Share2 className='size-3.5' />
        </button>
      </TooltipTrigger>
      <TooltipContent>{t`Share`}</TooltipContent>
    </Tooltip>
  )
}
