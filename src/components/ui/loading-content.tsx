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

// Centered spinner + message for a content area that is still loading or
// syncing in — e.g. a freshly-subscribed project, feed or wiki whose data is
// arriving over P2P. Prefer a skeleton (BoardSkeleton, ListSkeleton, …) when
// the final layout is known; reach for this when the content shape isn't known
// yet, or data is still syncing from a remote host and an empty view would
// otherwise read as "broken" rather than "loading".
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
