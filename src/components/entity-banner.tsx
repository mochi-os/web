// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: Apache-2.0

import { t } from '@lingui/core/macro'
import { useState } from 'react'
import { cn } from '../lib/utils'

type EntityBannerProps = {
  src?: string | null
  alt?: string
  className?: string
  aspectRatio?: string
}

export function EntityBanner({
  src,
  alt = t`Banner`,
  className,
  aspectRatio = '3 / 1',
}: EntityBannerProps) {
  const [errored, setErrored] = useState(false)

  if (!src || errored) {
    return null
  }

  return (
    <img
      src={src}
      alt={alt}
      onError={() => setErrored(true)}
      className={cn('w-full object-cover', className)}
      style={{ aspectRatio }}
    />
  )
}
