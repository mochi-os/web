// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: Apache-2.0

import { useMemo, type KeyboardEvent, type ReactNode } from 'react'
import { t } from '@lingui/core/macro'
import { Trans } from '@lingui/react/macro'
import type { UploadSlice } from '../lib/upload-slices'
import { RotateCcw, X } from 'lucide-react'
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
import { useDragReorder } from '../hooks/use-drag-reorder'
import { useFormat } from '../hooks/use-format'
import { getFileIcon, isMedia } from '../lib/attachment-utils'
import { cn } from '../lib/utils'

/**
 * Lifecycle of the files a composer is holding.
 *
 * `idle` — picked, not sent yet. `uploading` — in flight. `error` — the send
 * failed and the files are still staged so the user can retry.
 */
export type ComposerFileState = 'idle' | 'uploading' | 'error'

/**
 * One attachment being staged, normalised.
 *
 * This is the composer's counterpart to `GalleryAttachment`: the shared list
 * renders this and nothing else, and each app maps its own shape onto it. The
 * apps hold four different shapes — a bare `File`, a union of saved-and-new for
 * the edit forms, and chat's `PendingAttachment` with its voice-note fields —
 * and none of them belong in a shared component.
 *
 * Anything translated (`meta`, `badge`) is a node the app supplies, so the
 * component carries no copy that would have to be re-extracted into all 22
 * app catalogs.
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
  /** Second line. Defaults to the formatted size. */
  meta?: ReactNode
  /** Small label over the preview, such as a translated "New" chip. */
  badge?: ReactNode
  /**
   * Appearance for this one attachment, overriding the list's. One file over
   * the size limit is an error while the rest of the list is fine.
   * Deliberately appearance only: whether the list can be reordered or its
   * files removed is a property of the send, not of one attachment.
   */
  state?: ComposerFileState
  /**
   * This file's own share of the send in flight.
   *
   * Per item rather than a list on the composer, because the list a composer
   * shows is not always the list it uploads: chat hides voice notes from it,
   * and the edit forms mix saved attachments in with the new ones. The caller
   * owns lining the slices up with the array that actually goes into the body.
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
   * Supply to let the attachments be dragged into a different order. Omit and
   * they do not drag. Independent of `layout` and `preview` on purpose: a chat
   * box can want reordering without wanting 128px photo tiles in it.
   */
  onReorder?: (from: number, to: number) => void
  /**
   * Draw the images and video first and everything else after, which is the
   * order `AttachmentGallery` posts them in. The staged order is kept inside
   * each block, and a drag stays in the block it started in.
   *
   * Off by default. What a composer draws is the order its caller holds, and
   * only the composers whose attachments go on to the gallery gain anything
   * from splitting the two apart.
   */
  groupMedia?: boolean
  /**
   * Names for the two blocks `groupMedia` draws, as nodes the app supplies for
   * the same reason `meta` and `badge` are: a string added here lands in all 22
   * app catalogs, and only the composers that group have anything to name.
   *
   * Without them the blocks are still separated by a rule, so the wall a drag
   * cannot cross is visible either way.
   */
  blockLabels?: { media?: ReactNode; files?: ReactNode }
  /**
   * Rendered as the last cell of the grid, for the app's own "add files" tile.
   * It belongs in the grid rather than the dialog footer: adding files is
   * something you do to this list, not to the dialog.
   */
  addSlot?: ReactNode
  /** Offered when `state` is `error`. */
  onRetry?: () => void
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
  className,
}: AttachmentComposerProps) {
  const { formatFileSize } = useFormat()
  // A send in flight owns the order it is uploading; letting a drag race it
  // would change the list under the request that is already using it.
  const reorderable = Boolean(onReorder) && state !== 'uploading'

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
   * Arrow keys move the focused tile one place. Until now the order could only
   * be changed by dragging, which left keyboard users — and anyone on a screen
   * reader — with no way to change it at all. Left and right only: the grid
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

  // Media takes the first `mediaCount` drawn positions, so the rule goes in
  // front of the first file. `w-full` in a wrapping flex row is what breaks the
  // line — the two blocks would otherwise run together mid-row and the refused
  // drop between them would look like a bug. Grid only: a full-width child in
  // the sideways-scrolling row would be a gap as wide as the composer.
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

          // Byte counts only while this file is the one on the wire. "0 B of
          // 6.4 MB" on a queued file and "6.4 MB of 6.4 MB" on a finished one
          // are both noise, and the fill already says which is which.
          // sentLabel/totalLabel are named to match `UploadProgress`, so the
          // two share one message rather than adding a second to 22 catalogs.
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
              (item.meta ?? totalLabel)
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
    </div>
  )
}
