// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: Apache-2.0

import { type ImgHTMLAttributes, type Ref, useCallback } from 'react'
import { useAssetImage } from '../lib/shell-image'

export type AssetImageProps = Omit<
  ImgHTMLAttributes<HTMLImageElement>,
  'src'
> & {
  src?: string | null
  ref?: Ref<HTMLImageElement>
}

/**
 * An <img> for an image that may be this app's own: inside the shell's frame
 * its bytes come through the shell, from the browser's cache, rather than
 * from the network on every page view (see shell-image.ts). loading="lazy"
 * keeps its meaning.
 */
export function AssetImage({
  src,
  alt,
  loading,
  ref,
  style,
  ...rest
}: AssetImageProps) {
  const image = useAssetImage(src, loading === 'lazy')
  const watch = image.ref
  const attach = useCallback(
    (element: HTMLImageElement | null) => {
      watch(element)
      if (typeof ref === 'function') ref(element)
      else if (ref) ref.current = element
    },
    [watch, ref]
  )
  return (
    <img
      {...rest}
      ref={attach}
      src={image.src}
      // No alt text painted into the box while the bytes are on their way.
      alt={image.pending ? '' : alt}
      loading={loading}
      // Hidden, not unmounted, while the bytes are on their way: Chrome draws
      // its broken-image outline around a sized <img> with no src, which showed
      // as a grey frame inside every gallery tile until the photo arrived. The
      // element stays laid out so the lazy-load observer still sees it.
      style={image.pending ? { ...style, visibility: 'hidden' } : style}
    />
  )
}
