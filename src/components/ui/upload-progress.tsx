// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: Apache-2.0

import { Trans, useLingui } from '@lingui/react/macro'
import { cn } from '../../lib/utils'
import { useFormat } from '../../hooks/use-format'
import type { Upload } from '../../hooks/use-upload-progress'

/**
 * Byte-progress bar for a file upload: determinate while the body is leaving
 * the browser, indeterminate once the server is processing the completed
 * upload. Draws nothing when progress is null, so it can sit permanently in
 * a composer's layout.
 */
export function UploadProgress({
  progress,
  className,
}: {
  progress: Upload | null
  className?: string
}) {
  const { t } = useLingui()
  const { formatFileSize } = useFormat()
  if (!progress) return null
  const { sent, total, phase } = progress
  const determinate = phase === 'uploading' && total != null
  const fraction = determinate ? Math.min(sent / total, 1) : 1
  const sentLabel = formatFileSize(sent)
  const totalLabel = total != null ? formatFileSize(total) : ''
  return (
    <div className={cn('flex items-center gap-2', className)}>
      <div
        role='progressbar'
        aria-label={t`Upload progress`}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={determinate ? Math.round(fraction * 100) : undefined}
        className='bg-muted h-1.5 min-w-16 flex-1 overflow-hidden rounded-full'
      >
        <div
          className={cn(
            'bg-primary h-full rounded-full transition-[width] duration-300',
            !determinate && 'animate-pulse'
          )}
          style={{ width: `${fraction * 100}%` }}
        />
      </div>
      <span className='text-muted-foreground shrink-0 text-xs tabular-nums'>
        {phase === 'processing' ? (
          <Trans>Processing…</Trans>
        ) : total != null ? (
          <Trans>
            {sentLabel} of {totalLabel}
          </Trans>
        ) : (
          sentLabel
        )}
      </span>
    </div>
  )
}
