// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: Apache-2.0

import { Trans, useLingui } from '@lingui/react/macro'
import { cn } from '../../lib/utils'
import { useFormat } from '../../hooks/use-format'
import type { Upload } from '../../hooks/use-upload-progress'
import { Progress } from './progress'

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
      <Progress
        aria-label={t`Upload progress`}
        className='min-w-16 flex-1'
        value={determinate ? Math.round(fraction * 100) : null}
      />
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
