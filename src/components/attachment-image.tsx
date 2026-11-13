// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: Apache-2.0

import { useState, type SyntheticEvent } from 'react'
import { CloudOff, ImageOff } from 'lucide-react'
import { useLingui } from '@lingui/react/macro'
import { classifyAttachmentFailure } from '../lib/attachment-utils'
import { cn } from '../lib/utils'
import { AssetImage } from './asset-image'

export interface AttachmentImageProps {
  src: string
  alt: string
  className?: string
  onLoad?: (event: SyntheticEvent<HTMLImageElement>) => void
}

// How many times an image whose URL answers with its bytes is loaded again
// before it is shown as unavailable: one that keeps failing while its URL
// answers cannot be drawn, and is not retried for ever.
const attachment_retries = 2

/**
 * An attachment image that says WHY it failed. An <img>'s error event carries
 * no status, so this probes the same URL once and renders the server's
 * answer: "Unavailable" for a source that cannot be reached right now (503 -
 * the server retries after a backoff, so clicking the placeholder retries the
 * load), "Not found" for bytes that are gone (404). A probe that finds the
 * bytes there means the load failed in passing, and the image is loaded
 * again. One broken glyph for every case was the client contradicting a
 * server that tells them apart. The placeholder click stops propagation, so a
 * surrounding lightbox trigger never opens onto the same failure.
 *
 * Tiles load lazily and decode off the main thread: a photo feed or thread
 * holds dozens of them, and an eager <img> fetches every one as the page
 * renders, the ones far below the screen included.
 */
export function AttachmentImage({
  src,
  alt,
  className,
  onLoad,
}: AttachmentImageProps) {
  const { t } = useLingui()
  const [failure, setFailure] = useState<'unavailable' | 'missing' | null>(null)
  const [attempt, setAttempt] = useState(0)
  const [retries, setRetries] = useState(0)

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
          setRetries(0)
          setAttempt((n) => n + 1)
        }}
      >
        {failure === 'unavailable' ? (
          <CloudOff className='size-6' />
        ) : (
          <ImageOff className='size-6' />
        )}
        <span className='text-xs'>
          {failure === 'unavailable' ? t`Unavailable` : t`Not found`}
        </span>
      </div>
    )
  }

  return (
    <AssetImage
      key={attempt}
      src={src}
      alt={alt}
      loading='lazy'
      decoding='async'
      onError={() => {
        void classifyAttachmentFailure(src).then((answer) => {
          if (answer !== 'available') {
            setFailure(answer)
          } else if (retries < attachment_retries) {
            setRetries(retries + 1)
            setAttempt((n) => n + 1)
          } else {
            setFailure('unavailable')
          }
        })
      }}
      onLoad={onLoad}
      className={className}
    />
  )
}
