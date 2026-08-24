// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: Apache-2.0

import { useMemo, useState, type KeyboardEvent, type ReactNode } from 'react'
import { t } from '@lingui/core/macro'
import { Trans } from '@lingui/react/macro'
import type { UploadSlice } from '../lib/upload-slices'
import { Check, RotateCcw, X } from 'lucide-react'
import {
  Attachment,
  AttachmentAction,
  AttachmentActions,
  AttachmentContent,
  AttachmentDescription,
  AttachmentGroup,
  AttachmentMedia,
  AttachmentTile,
  AttachmentTitle,
} from './ui/attachment'
import { Button } from './ui/button'
import {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogFooter,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
} from './ui/responsive-dialog'
import { Textarea } from './ui/textarea'
import { useDragReorder } from '../hooks/use-drag-reorder'
import { useFormat } from '../hooks/use-format'
import { getFileIcon, isMedia } from '../lib/attachment-utils'
import { cn } from '../lib/utils'

/**
 * Longest caption the composer stages. Matches the bound the attachment library
 * holds peer captions to, so a local caption is not truncated on federation.
 */
const attachmentCaptionMaximum = 1000

/**
 * Lifecycle of a composer's files. On `error` they stay staged so the user can
 * retry.
 */
export type ComposerFileState = 'idle' | 'uploading' | 'error'

/**
 * One attachment being staged, normalised: the shared list renders this and
 * nothing else, and each app maps its own shape onto it. Anything translated
 * (`meta`, `badge`) is a node the app supplies, so this carries no copy.
 */
export interface ComposerItem {
  /** Stable across renders and reorders: React key and drag identity. */
  key: string
  name: string
  size: number
  /** MIME type, used to pick the icon when there is no preview. */
  type: string
  /** Already resolved by the caller, as the gallery resolves its URLs. */
  previewUrl?: string | null
  /** A video preview needs a <video>; an <img> renders nothing for one. */
  previewKind?: 'image' | 'video'
  /** Shown in the caption editor and, when set, as the second line. */
  caption?: string
  /** Second line. Defaults to the caption, then the formatted size. */
  meta?: ReactNode
  /** Small label over the preview, such as a translated "New" chip. */
  badge?: ReactNode
  /**
   * Appearance for this one attachment, overriding the list's. Appearance only:
   * whether the list reorders or removes is a property of the send.
   */
  state?: ComposerFileState
  /**
   * This file's own share of the send in flight. Per item because the list a
   * composer shows is not always the list it uploads; the caller lines the
   * slices up with the array that goes into the body.
   */
  progress?: UploadSlice
}

export interface AttachmentComposerProps {
  items: ComposerItem[]
  /**
   * `row` keeps one line that scrolls sideways; `grid` wraps onto as many rows
   * as it takes, so every attachment is on screen at once.
   */
  layout?: 'row' | 'grid'
  /** `inline` is a small thumbnail beside the name; `tile` is a square preview. */
  preview?: 'inline' | 'tile'
  state?: ComposerFileState
  onRemove?: (index: number) => void
  /**
   * Supply to let the attachments be dragged into a different order.
   * Independent of `layout` and `preview`: reordering does not imply photo
   * tiles.
   */
  onReorder?: (from: number, to: number) => void
  /**
   * Draw images and video first and everything else after, the order
   * `AttachmentGallery` posts them in. Staged order is kept inside each block,
   * and a drag stays in the block it started in. Off by default.
   */
  groupMedia?: boolean
  /**
   * Names for the two blocks `groupMedia` draws, as app-supplied nodes so no
   * string lands in every app catalog. Without them a rule still separates
   * them.
   */
  blockLabels?: { media?: ReactNode; files?: ReactNode }
  /**
   * Rendered as the last cell of the grid, for the app's own "add files" tile.
   */
  addSlot?: ReactNode
  /** Offered when `state` is `error`. */
  onRetry?: () => void
  /**
   * Supply to let media attachments carry captions: draws the caption button on
   * every media tile and receives what was saved (empty string removes it).
   * Tile preview only.
   */
  onCaption?: (index: number, caption: string) => void
  className?: string
}

/**
 * The staged attachment list every composer shares. Renders nothing when
 * empty, so callers do not have to guard it.
 */
export function AttachmentComposer({
  items,
  layout = 'row',
  preview = 'inline',
  state = 'idle',
  onRemove,
  onReorder,
  groupMedia = false,
  blockLabels,
  addSlot,
  onRetry,
  onCaption,
  className,
}: AttachmentComposerProps) {
  const { formatFileSize } = useFormat()
  // A send in flight owns the order it is uploading; letting a drag race it
  // would change the list under the request that is already using it.
  const reorderable = Boolean(onReorder) && state !== 'uploading'
  // Staged index of the item whose caption is being edited, or null.
  const [captioning, setCaptioning] = useState<number | null>(null)

  // Indices into `items`, in the order they are drawn. Everything handed back
  // to the caller — a removal, a reorder — is translated through this, so the
  // array the caller holds stays the staged order and never becomes the drawn
  // one. Grouping is a way of showing that array, not a way of rewriting it.
  const order = useMemo(() => {
    const indices = items.map((_, index) => index)
    if (!groupMedia) return indices
    return [
      ...indices.filter((index) => isMedia(items[index].type)),
      ...indices.filter((index) => !isMedia(items[index].type)),
    ]
  }, [items, groupMedia])

  // Media takes the first `mediaCount` drawn positions, so a position says
  // which block it is in. Dragging a tile into the other block would land it at
  // that block's edge instead of under the pointer, so those slots refuse it.
  const mediaCount = items.filter((item) => isMedia(item.type)).length
  const sameBlock = (from: number, to: number) =>
    (from < mediaCount) === (to < mediaCount)

  const { draggingIndex, getGroupProps, getItemProps } = useDragReorder({
    count: items.length,
    enabled: reorderable,
    // The hook counts in drawn positions; the caller counts in staged ones.
    onMove: (from, to) => onReorder?.(order[from], order[to]),
    canMove: groupMedia ? sameBlock : undefined,
  })

  if (items.length === 0 && !addSlot) return null

  const canDrag = reorderable && items.length > 1
  const removable = state !== 'uploading' && Boolean(onRemove)
  const dragClass = cn('select-none', canDrag && 'cursor-grab active:cursor-grabbing')

  /**
   * Arrow keys move the focused tile one place. Left and right only: the grid
   * wraps at a width nothing here knows, so up and down have no honest meaning.
   */
  const moveByKey = (position: number, delta: number) => {
    const to = position + delta
    if (to < 0 || to >= items.length) return
    if (groupMedia && !sameBlock(position, to)) return
    onReorder?.(order[position], order[to])
  }

  const keyProps = (position: number) =>
    canDrag
      ? {
          tabIndex: 0,
          onKeyDown: (event: KeyboardEvent<HTMLElement>) => {
            const step =
              event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0
            if (step === 0) return
            event.preventDefault()
            // Read the direction off the tile rather than assuming: in an RTL
            // locale the tile to the visual right is the previous one.
            const rtl =
              getComputedStyle(event.currentTarget).direction === 'rtl'
            moveByKey(position, rtl ? -step : step)
          },
        }
      : {}

  // The rule goes in front of the first file. `w-full` is what breaks the line
  // in a wrapping flex row; grid only, since in the scrolling row it would be a
  // gap as wide as the composer.
  const dividerAt =
    layout === 'grid' && groupMedia && mediaCount > 0 && mediaCount < items.length
      ? mediaCount
      : -1

  return (
    <div className={cn('space-y-1', className)}>
      {blockLabels?.media && mediaCount > 0 && (
        <div className='text-muted-foreground text-[11px] font-medium'>
          {blockLabels.media}
        </div>
      )}
      <AttachmentGroup layout={layout} {...getGroupProps()}>
        {order.flatMap((index, position) => {
          const item = items[index]
          const FileIcon = getFileIcon(item.type)
          const itemState = item.state ?? state
          // Only the composer that is actually sending draws fills. Comment
          // trees hand one `useUploadProgress` to every box in the tree, so an
          // idle box holding staged files would otherwise render the sending
          // box's slices against its own list — the wrong files, filling.
          const slice = itemState === 'uploading' ? item.progress : undefined

          // Byte counts only while this file is on the wire; on a queued or
          // finished file they are noise. sentLabel/totalLabel match
          // `UploadProgress` so the two share one message.
          const sentLabel = formatFileSize(
            Math.round((slice?.fraction ?? 0) * item.size)
          )
          const totalLabel = formatFileSize(item.size)
          const meta =
            slice?.state === 'uploading' ? (
              <Trans>
                {sentLabel} of {totalLabel}
              </Trans>
            ) : (
              (item.meta ?? (item.caption || totalLabel))
            )

          const rule =
            position === dividerAt ? (
              <div key='block-rule' className='flex w-full items-center gap-2 pt-1'>
                {blockLabels?.files && (
                  <span className='text-muted-foreground text-[11px] font-medium'>
                    {blockLabels.files}
                  </span>
                )}
                <span aria-hidden className='bg-border h-px flex-1' />
              </div>
            ) : null

          if (preview === 'tile') {
            return [
              rule,
              <AttachmentTile
                key={item.key}
                name={item.name}
                meta={meta}
                previewUrl={item.previewUrl}
                previewKind={item.previewKind}
                icon={<FileIcon />}
                badge={item.badge}
                state={itemState}
                progress={slice}
                dragging={draggingIndex === position}
                draggable={canDrag}
                position={canDrag ? position + 1 : undefined}
                aria-label={item.name}
                onRemove={removable ? () => onRemove?.(index) : undefined}
                removeLabel={t`Remove`}
                onCaption={
                  onCaption && isMedia(item.type) && state !== 'uploading'
                    ? () => setCaptioning(index)
                    : undefined
                }
                captionLabel={item.caption ? t`Edit caption` : t`Add caption`}
                {...getItemProps(position)}
                {...keyProps(position)}
                className={dragClass}
              />,
            ]
          }

          return [
            rule,
            <Attachment
              key={item.key}
              state={itemState}
              progress={slice}
              size='sm'
              {...getItemProps(position)}
              className={cn(
                dragClass,
                draggingIndex === position &&
                  'ring-primary z-10 scale-105 shadow-lg ring-2'
              )}
            >
              <AttachmentMedia variant={item.previewUrl ? 'image' : 'icon'}>
                {item.previewUrl && item.previewKind === 'video' ? (
                  <video src={item.previewUrl} muted playsInline draggable={false} />
                ) : item.previewUrl ? (
                  <img src={item.previewUrl} alt={item.name} draggable={false} />
                ) : (
                  <FileIcon />
                )}
              </AttachmentMedia>
              <AttachmentContent>
                <AttachmentTitle>{item.name}</AttachmentTitle>
                <AttachmentDescription>{meta}</AttachmentDescription>
              </AttachmentContent>
              {removable && (
                <AttachmentActions>
                  <AttachmentAction
                    onClick={() => onRemove?.(index)}
                    aria-label={t`Remove`}
                  >
                    <X className='size-4' />
                  </AttachmentAction>
                </AttachmentActions>
              )}
            </Attachment>,
          ]
        })}
        {addSlot}
      </AttachmentGroup>
      {state === 'error' && onRetry && (
        <button
          type='button'
          onClick={onRetry}
          className='text-destructive hover:bg-destructive/10 inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-xs transition-colors active:translate-y-px'
        >
          <RotateCcw className='size-3' />
          <Trans>Retry</Trans>
        </button>
      )}
      {captioning != null && items[captioning] && (
        <AttachmentCaptionDialog
          item={items[captioning]}
          onSave={(caption) => {
            onCaption?.(captioning, caption)
            setCaptioning(null)
          }}
          onClose={() => setCaptioning(null)}
        />
      )}
    </div>
  )
}

/**
 * Caption editor for one media attachment; saving an empty text removes the
 * caption. Opened by the composer for staged files, and directly by managers of
 * saved attachments with an item built from the saved row.
 */
export function AttachmentCaptionDialog({
  item,
  onSave,
  onClose,
}: {
  item: Pick<ComposerItem, 'name' | 'caption' | 'previewUrl' | 'previewKind'>
  onSave: (caption: string) => void
  onClose: () => void
}) {
  const [value, setValue] = useState(item.caption ?? '')

  return (
    <ResponsiveDialog open onOpenChange={(open) => !open && onClose()}>
      <ResponsiveDialogContent className='sm:max-w-md'>
        <ResponsiveDialogHeader>
          <ResponsiveDialogTitle>
            <Trans>Caption</Trans>
          </ResponsiveDialogTitle>
        </ResponsiveDialogHeader>
        <div className='space-y-3'>
          {item.previewUrl && (
            <div className='bg-muted flex max-h-[40vh] items-center justify-center overflow-hidden rounded-[8px]'>
              {item.previewKind === 'video' ? (
                <video
                  src={item.previewUrl}
                  muted
                  playsInline
                  className='max-h-[40vh] max-w-full object-contain'
                />
              ) : (
                <img
                  src={item.previewUrl}
                  alt={item.name}
                  className='max-h-[40vh] max-w-full object-contain'
                />
              )}
            </div>
          )}
          <Textarea
            value={value}
            onChange={(event) => setValue(event.target.value)}
            onKeyDown={(event) => {
              // Captions are a line or two; Enter saves, Shift+Enter breaks.
              if (event.key === 'Enter' && !event.shiftKey) {
                event.preventDefault()
                onSave(value.trim())
              }
            }}
            maxLength={attachmentCaptionMaximum}
            rows={2}
            autoFocus
            aria-label={t`Caption`}
          />
        </div>
        <ResponsiveDialogFooter className='gap-2 pt-2'>
          <Button type='button' variant='outline' onClick={onClose}>
            <Trans>Cancel</Trans>
          </Button>
          <Button type='button' onClick={() => onSave(value.trim())}>
            <Check className='size-4' />
            <Trans>Save</Trans>
          </Button>
        </ResponsiveDialogFooter>
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  )
}
