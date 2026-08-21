// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: Apache-2.0

import { Loader2 } from 'lucide-react'
import { Trans } from '@lingui/react/macro'
import { cn } from '../../lib/utils'

interface LoadingContentProps {
  /** Override the default "Loading content…" message. */
  label?: string
  className?: string
}

// Centered spinner and message for content that is loading or still syncing
// over P2P. Prefer a skeleton when the final layout is known; use this when it
// is not.
export function LoadingContent({ label, className }: LoadingContentProps) {
  return (
    <div
      className={cn(
        'text-muted-foreground flex flex-col items-center justify-center gap-3 py-16',
        className
      )}
    >
      <Loader2 className='size-6 animate-spin' />
      <p className='text-sm'>{label ?? <Trans>Loading content…</Trans>}</p>
    </div>
  )
}
