// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: Apache-2.0

import { useCallback, useState, type ReactNode, type SyntheticEvent } from 'react'
import { Loader2, Play } from 'lucide-react'
import { useLingui } from '@lingui/react/macro'
import { ImageLightbox, type LightboxMedia } from './ui/image-lightbox'
import {
  Attachment,
  AttachmentContent,
  AttachmentDescription,
  AttachmentMedia,
  AttachmentTitle,
  AttachmentTrigger,
} from './ui/attachment'
import { useLightboxHash } from '../hooks/use-lightbox-hash'
import { formatVideoDuration, useVideoThumbnailCached } from '../hooks/use-video-thumbnail'
import { getFileIcon, isMedia, isVideo } from '../lib/attachment-utils'
import { useFormat } from '../hooks/use-format'

export interface GalleryAttachment {
  id: string
  name: string
  type: string
  size: number
  url?: string
  thumbnail_url?: string
  preview_url?: string
}

export interface AttachmentGalleryProps {
  attachments: GalleryAttachment[]
  // Resolve the full-size URL. Falls back to att.url if omitted.
  getUrl?: (att: GalleryAttachment) => string
  // Resolve the thumbnail URL. Falls back to att.thumbnail_url, then att.url, then getUrl.
  getThumbnailUrl?: (att: GalleryAttachment) => string
  // Resolve the preview URL (larger image variant) for media tiles. Pass this
  // for post/object galleries whose tiles render large; omit it for small
  // galleries (comments), whose tiles then stay on the thumbnail chain.
  getPreviewUrl?: (att: GalleryAttachment) => string
  // Target row height in px. 80 fits comments, 140 matches MapView thumbs, 200 for big posts. Default 140.
  rowHeight?: number
  // Cap on visible media items; overflow collapses into a "+N" overlay on the last tile.
  mediaCap?: number
  // Render items directly without the outer space-y wrapper, for use inside a parent flex layout.
  inline?: boolean
  // Skip rendering the file list (only show media).
  hideFiles?: boolean
  // Optional sibling overlay rendered next to each media tile (e.g. hover-delete on CRM cards).
  renderMediaOverlay?: (att: GalleryAttachment) => ReactNode
}

const DEFAULT_ASPECT = 1.5

function VideoTile({ url, onAspect }: { url: string; onAspect: (ratio: number) => void }) {
  const { t } = useLingui()
  const { url: thumbnailUrl, loading, error, duration } = useVideoThumbnailCached(url)

  if (loading) {
    return (
      <div className='bg-muted flex h-full w-full items-center justify-center'>
        <Loader2 className='text-muted-foreground size-6 animate-spin' />
      </div>
    )
  }

  if (error || !thumbnailUrl) {
    return (
      <div className='bg-muted flex h-full w-full items-center justify-center'>
        <Play className='text-muted-foreground size-10' />
      </div>
    )
  }

  return (
    <>
      <img
        src={thumbnailUrl}
        alt={t`Video thumbnail`}
        onLoad={(e) => {
          const img = e.currentTarget
          if (img.naturalWidth && img.naturalHeight) {
            onAspect(img.naturalWidth / img.naturalHeight)
          }
        }}
        className='h-full w-full object-cover transition-transform group-hover/thumb:scale-105'
      />
      <div className='absolute inset-0 flex items-center justify-center'>
        <div className='rounded-full bg-black/50 p-2'>
          <Play className='size-6 text-white' />
        </div>
      </div>
      {duration != null && (
        <div className='absolute right-1 bottom-1 rounded bg-black/70 px-1.5 py-0.5 text-xs font-medium text-white'>
          {formatVideoDuration(duration)}
        </div>
      )}
    </>
  )
}

export function AttachmentGallery({
  attachments,
  getUrl,
  getThumbnailUrl,
  getPreviewUrl,
  rowHeight = 140,
  mediaCap,
  inline = false,
  hideFiles = false,
  renderMediaOverlay,
}: AttachmentGalleryProps) {
  const { formatFileSize } = useFormat()
  // Aspect-ratio per attachment, measured onLoad. Drives flex-grow / flex-basis for the justified-grid layout.
  const [aspects, setAspects] = useState<Record<string, number>>({})
  const setAspect = useCallback((id: string, ratio: number) => {
    setAspects((prev) => (prev[id] === ratio ? prev : { ...prev, [id]: ratio }))
  }, [])

  const resolveUrl = useCallback(
    (att: GalleryAttachment): string => getUrl ? getUrl(att) : (att.url ?? ''),
    [getUrl]
  )

  const resolveThumb = useCallback(
    (att: GalleryAttachment): string => {
      if (getThumbnailUrl) return getThumbnailUrl(att)
      if (att.thumbnail_url) return att.thumbnail_url
      if (att.url) return att.url
      return resolveUrl(att)
    },
    [getThumbnailUrl, resolveUrl]
  )

  // Media tiles use the preview variant only when the consumer opts in; the
  // automatic fallback stays on the thumbnail chain so small galleries never
  // silently upgrade to the heavier variant.
  const resolveTile = useCallback(
    (att: GalleryAttachment): string => getPreviewUrl ? getPreviewUrl(att) : resolveThumb(att),
    [getPreviewUrl, resolveThumb]
  )

  const media = (attachments ?? []).filter((att) => isMedia(att.type))
  const files = (attachments ?? []).filter((att) => !isMedia(att.type))

  const lightboxMedia: LightboxMedia[] = media.map((att) => ({
    id: att.id,
    name: att.name,
    url: resolveUrl(att),
    type: isVideo(att.type) ? 'video' : 'image',
  }))

  const { open, currentIndex, openLightbox, closeLightbox, setCurrentIndex } =
    useLightboxHash(lightboxMedia)

  if (!attachments || attachments.length === 0) {
    return null
  }

  const cap = mediaCap != null && mediaCap >= 0 ? mediaCap : media.length
  const visibleMedia = media.length > cap ? media.slice(0, cap) : media
  const extraCount = Math.max(0, media.length - cap)

  // Items in a row distribute width proportionally to aspect ratio, so every item in the row ends at the
  // same height. flex-basis = natural width at the target row-height controls row wrapping. A trailing
  // spacer with massive flex-grow absorbs any surplus on a sparse last row.
  const mediaButtons = visibleMedia.map((attachment, index) => {
    const ratio = aspects[attachment.id] ?? DEFAULT_ASPECT
    return (
      <div
        key={attachment.id}
        className='group/item relative'
        style={{
          flex: `${ratio} 1 ${ratio * rowHeight}px`,
          height: `${rowHeight}px`,
        }}
      >
        <button
          type='button'
          onClick={(e) => {
            e.stopPropagation()
            openLightbox(index)
          }}
          className='group/thumb bg-muted relative block h-full w-full overflow-hidden rounded-[8px] border'
        >
          {isVideo(attachment.type) ? (
            <VideoTile
              url={resolveUrl(attachment)}
              onAspect={(r) => setAspect(attachment.id, r)}
            />
          ) : (
            <img
              src={resolveTile(attachment)}
              alt={attachment.name}
              onLoad={(e: SyntheticEvent<HTMLImageElement>) => {
                const img = e.currentTarget
                if (img.naturalWidth && img.naturalHeight) {
                  setAspect(attachment.id, img.naturalWidth / img.naturalHeight)
                }
              }}
              className='h-full w-full object-cover transition-transform group-hover/thumb:scale-105'
            />
          )}
          {index === visibleMedia.length - 1 && extraCount > 0 && (
            <div className='absolute inset-0 flex items-center justify-center bg-black/50'>
              <span className='text-2xl font-bold text-white'>+{extraCount}</span>
            </div>
          )}
        </button>
        {renderMediaOverlay?.(attachment)}
      </div>
    )
  })

  // Wrapped rather than stacked: the chips already size to their own content,
  // so several documents pack across the line instead of spending a row each.
  // Not square tiles — a document has no thumbnail to recognise it by, and a
  // tile narrow enough to grid neatly cuts the name off long before the part
  // that tells one audit from another.
  const fileLinks = !hideFiles && files.length > 0 ? (
    <div className="flex flex-wrap gap-1">
      {files.map((attachment) => {
        const FileIcon = getFileIcon(attachment.type)
        return (
          <Attachment
            key={attachment.id}
            size="sm"
            // Without a ceiling one long filename takes the whole line and the
            // wrapping buys nothing on that row. min() keeps the narrow-screen
            // clamp that the base max-w-full was providing.
            className="max-w-[min(100%,20rem)]"
          >
            <AttachmentTrigger asChild>
              <a
                href={resolveUrl(attachment)}
                onClick={(e) => e.stopPropagation()}
              >
                <span className="sr-only">{attachment.name}</span>
              </a>
            </AttachmentTrigger>
            <AttachmentMedia>
              <FileIcon />
            </AttachmentMedia>
            <AttachmentContent>
              <AttachmentTitle>{attachment.name}</AttachmentTitle>
              <AttachmentDescription>
                {formatFileSize(attachment.size)}
              </AttachmentDescription>
            </AttachmentContent>
          </Attachment>
        )
      })}
    </div>
  ) : null

  const spacer = <span aria-hidden className='block h-0 grow-[999] basis-0' />

  const lightbox = (
    <ImageLightbox
      images={lightboxMedia}
      currentIndex={currentIndex}
      open={open}
      onOpenChange={(isOpen) => !isOpen && closeLightbox()}
      onIndexChange={setCurrentIndex}
    />
  )

  if (inline) {
    return (
      <>
        {mediaButtons}
        {media.length > 0 && spacer}
        {fileLinks}
        {lightbox}
      </>
    )
  }

  return (
    <div className='space-y-3'>
      {media.length > 0 && (
        <div className='flex flex-wrap items-start gap-2'>
          {mediaButtons}
          {spacer}
        </div>
      )}
      {fileLinks}
      {lightbox}
    </div>
  )
}
