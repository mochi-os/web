// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: Apache-2.0

import { useState, type SyntheticEvent } from 'react'
import { CloudOff, ImageOff } from 'lucide-react'
import { useLingui } from '@lingui/react/macro'
import { classifyAttachmentFailure } from '../lib/attachment-utils'
import { cn } from '../lib/utils'

export interface AttachmentImageProps {
  src: string
  alt: string
  className?: string
  onLoad?: (event: SyntheticEvent<HTMLImageElement>) => void
}

/**
 * An attachment image that says WHY it failed. An <img>'s error event carries
 * no status, so this probes the same URL once and renders the server's
 * answer: "Unavailable" for a source that cannot be reached right now (503 -
 * the server retries after a backoff, so clicking the placeholder retries the
 * load), "Not found" for bytes that are gone (404). One broken glyph for both
 * was the client contradicting a server that tells them apart. The placeholder
 * click stops propagation, so a surrounding lightbox trigger never opens onto
 * the same failure.
 */
export function AttachmentImage({ src, alt, className, onLoad }: AttachmentImageProps) {
  const { t } = useLingui()
  const [failure, setFailure] = useState<'unavailable' | 'missing' | null>(null)
  const [attempt, setAttempt] = useState(0)

  if (failure) {
    return (
      <div
        className={cn(
          'text-muted-foreground bg-muted flex flex-col items-center justify-center gap-1',
          className
        )}
        onClick={(e) => {
          e.stopPropagation()
          setFailure(null)
          setAttempt((n) => n + 1)
        }}
      >
        {failure === 'unavailable' ? (
          <CloudOff className='size-6' />
        ) : (
          <ImageOff className='size-6' />
        )}
        <span className='text-xs'>{failure === 'unavailable' ? t`Unavailable` : t`Not found`}</span>
      </div>
    )
  }

  return (
    <img
      key={attempt}
      src={src}
      alt={alt}
      onError={() => {
        void classifyAttachmentFailure(src).then(setFailure)
      }}
      onLoad={onLoad}
      className={className}
    />
  )
}
