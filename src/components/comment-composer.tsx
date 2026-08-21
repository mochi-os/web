// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: Apache-2.0

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { t } from '@lingui/core/macro'
import { Loader2, Paperclip, Send, X } from 'lucide-react'
import { ConfirmDialog } from './confirm-dialog'
import {
  AttachmentComposer,
  type AttachmentComposerProps,
  type ComposerFileState,
} from './attachment-composer'
import { MentionTextarea, type MentionUser } from './mention-textarea'
import { Button } from './ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from './ui/tooltip'
import { UploadProgress } from './ui/upload-progress'
import { useImageObjectUrls } from '../hooks/use-image-object-urls'
import type { Upload } from '../hooks/use-upload-progress'
import { isMedia, isVideo, pendingFileKey, removePendingFile } from '../lib/attachment-utils'
import { mergePendingFiles } from '../lib/composer-files'
import { moveItem } from '../lib/reorder'
import type { UploadSlice } from '../lib/upload-slices'
import { toast } from '../lib/toast-utils'
import { cn } from '../lib/utils'

const isMacPlatform = () =>
  typeof navigator !== 'undefined' &&
  /Mac|iPhone|iPad|iPod/.test(navigator.userAgent)

const COARSE_POINTER = '(hover: none) and (pointer: coarse)'

/**
 * False on phones and tablets, where there is no key to press. Reads the query
 * up front so the hint never flashes in before it is hidden.
 */
function useHasKeyboard(): boolean {
  const [hasKeyboard, setHasKeyboard] = useState(
    () =>
      typeof window === 'undefined' ||
      !window.matchMedia(COARSE_POINTER).matches
  )

  useEffect(() => {
    const query = window.matchMedia(COARSE_POINTER)
    const apply = () => setHasKeyboard(!query.matches)
    apply()
    query.addEventListener('change', apply)
    return () => query.removeEventListener('change', apply)
  }, [])

  return hasKeyboard
}

/**
 * Send shortcut chip. Decorative only - the Send button carries the accessible
 * name, so this stays out of the accessibility tree and the message catalogs.
 */
export function SendShortcutHint({ className }: { className?: string }) {
  const hasKeyboard = useHasKeyboard()
  if (!hasKeyboard) return null

  return (
    <span
      aria-hidden
      className={cn(
        'text-muted-foreground/70 me-auto font-mono text-[11px] leading-none select-none',
        className
      )}
    >
      {/* Keycap labels, deliberately out of the catalogs: the chip is
          aria-hidden and the Send button carries the accessible name (see the
          doc comment above). */}
      {/* eslint-disable-next-line lingui/no-unlocalized-strings */}
      {isMacPlatform() ? '⌘' : 'Ctrl'}
      <span className='ms-0.5'>{'↵'}</span>
    </span>
  )
}

/**
 * Fails a send before it starts when the browser knows it has no network -
 * uploads carry no timeout, so the request would otherwise spin. True when the
 * send was blocked and already reported.
 */
export function offlineBlocked(): boolean {
  if (typeof navigator === 'undefined' || navigator.onLine !== false) {
    return false
  }
  toast.error(t`Please check your internet connection and try again.`)
  return true
}

const carriesFiles = (transfer: DataTransfer | null) =>
  Array.from(transfer?.types ?? []).includes('Files')

/**
 * Drag-and-drop and paste-to-attach for a composer. Spread `dropzoneProps` on
 * the element wrapping the text field and the attachment list; paste bubbles up
 * from the textarea and is swallowed only when the clipboard carries files.
 */
export function useComposerDrop({
  onFiles,
  disabled = false,
}: {
  onFiles: (files: File[]) => void
  disabled?: boolean
}) {
  // Nested children fire dragleave as the pointer crosses them, so track the
  // enter/leave depth instead of toggling on the first leave.
  const depth = useRef(0)
  const [isDragActive, setIsDragActive] = useState(false)

  // The composer claims the drop even while it is busy. Letting it through
  // would hand the file to the browser, which navigates away from the page and
  // takes the draft with it.
  const onDragEnter = useCallback(
    (e: React.DragEvent) => {
      if (!carriesFiles(e.dataTransfer)) return
      e.preventDefault()
      if (disabled) return
      depth.current += 1
      setIsDragActive(true)
    },
    [disabled]
  )

  const onDragOver = useCallback(
    (e: React.DragEvent) => {
      if (!carriesFiles(e.dataTransfer)) return
      e.preventDefault()
      e.dataTransfer.dropEffect = disabled ? 'none' : 'copy'
    },
    [disabled]
  )

  const onDragLeave = useCallback(() => {
    if (disabled) return
    depth.current = Math.max(0, depth.current - 1)
    if (depth.current === 0) setIsDragActive(false)
  }, [disabled])

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      if (!carriesFiles(e.dataTransfer)) return
      e.preventDefault()
      depth.current = 0
      setIsDragActive(false)
      if (disabled) return
      const dropped = Array.from(e.dataTransfer.files)
      if (dropped.length > 0) onFiles(dropped)
    },
    [disabled, onFiles]
  )

  const onPaste = useCallback(
    (e: React.ClipboardEvent) => {
      if (disabled) return
      const pasted = Array.from(e.clipboardData?.files ?? [])
      if (pasted.length === 0) return
      e.preventDefault()
      onFiles(pasted)
    },
    [disabled, onFiles]
  )

  return {
    isDragActive,
    dropzoneProps: { onDragEnter, onDragOver, onDragLeave, onDrop, onPaste },
  }
}

/** Outline shown while files are hovering over a composer. */
export const dropActiveClass =
  'outline-primary/50 bg-primary/5 rounded-lg outline-2 outline-offset-4 outline-dashed'

interface ComposerAttachmentsProps {
  files: File[]
  previewUrls: (string | null)[]
  state?: ComposerFileState
  /**
   * Per-file upload progress, index-aligned with `files`. Safe here because
   * every caller stages the same array it uploads; one whose list differs uses
   * `AttachmentComposer` directly and maps by key.
   */
  progress?: UploadSlice[]
  onRemove: (file: File) => void
  onRetry?: () => void
  /** Supply to let the files be dragged into a different order. */
  onReorder?: (from: number, to: number) => void
  /** Defaults to `grid` once reordering is on, `row` otherwise. */
  layout?: AttachmentComposerProps['layout']
  /** Defaults to `tile` once reordering is on, `inline` otherwise. */
  preview?: AttachmentComposerProps['preview']
  /** Draw the images and video first, as the posted comment will. */
  groupMedia?: AttachmentComposerProps['groupMedia']
  /** Names for the two blocks `groupMedia` draws. */
  blockLabels?: AttachmentComposerProps['blockLabels']
  /** The app's own "add files" tile, drawn as the last cell of the grid. */
  addSlot?: AttachmentComposerProps['addSlot']
  /**
   * Captions keyed by `pendingFileKey(file)`. Keyed rather than index-aligned
   * so a reorder or removal never re-attaches a caption to the wrong file.
   */
  captions?: Record<string, string>
  /** Supply to let media files carry captions; see `AttachmentComposer`. */
  onCaption?: (file: File, caption: string) => void
}

/**
 * `File[]` wrapper around `AttachmentComposer`, for composers that stage plain
 * files. Anything holding a richer item maps onto `ComposerItem` and uses
 * `AttachmentComposer` directly.
 */
export function ComposerAttachments({
  files,
  previewUrls,
  state = 'idle',
  progress,
  onRemove,
  onRetry,
  onReorder,
  layout,
  preview,
  groupMedia,
  blockLabels,
  addSlot,
  captions,
  onCaption,
}: ComposerAttachmentsProps) {
  const items = useMemo(
    () =>
      files.map((file, i) => ({
        key: pendingFileKey(file),
        name: file.name,
        size: file.size,
        type: file.type,
        // Media, not images: `useImageObjectUrls` mints a URL for a staged clip
        // too, and asking only about images here threw it away and left the
        // video drawing an icon inside the media block.
        previewUrl: isMedia(file.type) ? previewUrls[i] : null,
        previewKind: isVideo(file.type) ? ('video' as const) : ('image' as const),
        caption: captions?.[pendingFileKey(file)],
        progress: progress?.[i],
      })),
    [files, previewUrls, progress, captions]
  )

  return (
    <AttachmentComposer
      items={items}
      // Reordering names in a sideways-scrolling row is no use to anyone, so
      // asking for it opts into the grid of previews unless told otherwise.
      layout={layout ?? (onReorder ? 'grid' : 'row')}
      preview={preview ?? (onReorder ? 'tile' : 'inline')}
      state={state}
      onRemove={(index) => onRemove(files[index])}
      onReorder={onReorder}
      groupMedia={groupMedia}
      blockLabels={blockLabels}
      addSlot={addSlot}
      onRetry={onRetry}
      onCaption={
        onCaption ? (index, caption) => onCaption(files[index], caption) : undefined
      }
    />
  )
}

/**
 * Guards closing a composer that still holds a draft. `requestClose` closes
 * when there is nothing to lose, asks when there is, and does nothing while a
 * send is in flight, so Escape cannot discard a comment mid-request.
 */
export function useDiscardGuard({
  hasText,
  hasFiles,
  onDiscard,
  locked = false,
}: {
  hasText: boolean
  hasFiles: boolean
  onDiscard: () => void
  locked?: boolean
}) {
  const [confirming, setConfirming] = useState(false)
  const hasContent = hasText || hasFiles

  const requestClose = useCallback(() => {
    if (locked) return
    if (hasContent) {
      setConfirming(true)
      return
    }
    onDiscard()
  }, [hasContent, locked, onDiscard])

  // Name only what is actually about to go, so the warning matches the form.
  const desc =
    hasText && hasFiles
      ? t`Your text and attachments will be lost.`
      : hasFiles
        ? t`Your attachments will be lost.`
        : t`Your text will be lost.`

  const discardDialog = (
    <ConfirmDialog
      open={confirming}
      onOpenChange={setConfirming}
      title={t`Discard draft?`}
      desc={desc}
      confirmText={t`Discard`}
      destructive
      handleConfirm={() => {
        setConfirming(false)
        onDiscard()
      }}
    />
  )

  return { requestClose, discardDialog }
}

export interface CommentBoxProps {
  /** The draft, held by the caller so it can survive the box closing. */
  value: string
  onValueChange: (value: string) => void
  /**
   * Sends the draft with whatever files are staged. Reject to keep the box
   * open in its failed state - draft and files intact - with Retry offered.
   */
  onSubmit: (body: string, files?: File[]) => void | Promise<void>
  /**
   * Given, the box carries Cancel and closes on Escape through this; the caller
   * owns any discard guard. Neither fires while a send is in flight.
   */
  onClose?: () => void
  /** Which pair of labels the buttons carry. */
  kind?: 'comment' | 'reply'
  placeholder?: string
  /** Upload progress of the send in flight, if the caller tracks one. */
  progress?: Upload | null
  /** Mention sources, as `MentionTextarea` takes them. */
  people?: MentionUser[]
  onSearchPeople?: (query: string) => Promise<MentionUser[]>
  /** Reports the staged file count, so a guard outside can ask before discarding. */
  onFilesChange?: (count: number) => void
  rows?: number
  autoFocus?: boolean
  className?: string
  textareaClassName?: string
}

/**
 * The comment box: mention-aware textarea, staged attachments with drop,
 * reorder and per-file retry, upload progress, and the attach / cancel / send
 * row. It owns its files and sending state; the draft is the caller's.
 */
export function CommentBox({
  value,
  onValueChange,
  onSubmit,
  onClose,
  kind = 'comment',
  placeholder,
  progress,
  people,
  onSearchPeople,
  onFilesChange,
  rows = 2,
  autoFocus,
  className,
  textareaClassName,
}: CommentBoxProps) {
  const [files, setFiles] = useState<File[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [failed, setFailed] = useState(false)
  const previewUrls = useImageObjectUrls(files)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    onFilesChange?.(files.length)
  }, [files.length, onFilesChange])

  const addFiles = useCallback((incoming: File[]) => {
    setFailed(false)
    setFiles((prev) => mergePendingFiles(prev, incoming))
  }, [])

  // Editing after a failure means the red attachments and the Retry button no
  // longer describe what is in the box.
  const handleValueChange = useCallback(
    (next: string) => {
      setFailed(false)
      onValueChange(next)
    },
    [onValueChange]
  )

  const { isDragActive, dropzoneProps } = useComposerDrop({
    onFiles: addFiles,
    disabled: submitting,
  })

  const submit = useCallback(async () => {
    const body = value.trim()
    if (!body || submitting || offlineBlocked()) return
    setSubmitting(true)
    setFailed(false)
    try {
      await onSubmit(body, files.length > 0 ? files : undefined)
      setFiles([])
    } catch {
      // The caller reported the failure; the draft and files stay for Retry.
      setFailed(true)
    } finally {
      setSubmitting(false)
    }
  }, [value, files, submitting, onSubmit])

  const close = useCallback(() => {
    if (!submitting) onClose?.()
  }, [submitting, onClose])

  const labels =
    kind === 'reply'
      ? { attach: t`Attach reply files`, cancel: t`Cancel reply`, send: t`Submit reply` }
      : { attach: t`Attach comment files`, cancel: t`Cancel comment`, send: t`Submit comment` }

  return (
    <div
      className={cn('space-y-2', isDragActive && dropActiveClass, className)}
      // Close on Escape from anywhere in the box: after picking a file, focus
      // sits on a button, so the textarea's Escape never fires.
      onKeyDown={(event) => {
        if (event.key === 'Escape' && onClose) close()
      }}
      {...dropzoneProps}
    >
      <MentionTextarea
        placeholder={placeholder}
        value={value}
        onValueChange={handleValueChange}
        people={people}
        onSearchPeople={onSearchPeople}
        onKeyDown={(event) => {
          if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
            event.preventDefault()
            void submit()
          }
        }}
        className={cn(
          'placeholder:text-muted-foreground min-h-0 disabled:cursor-not-allowed disabled:opacity-50',
          textareaClassName
        )}
        rows={rows}
        autoFocus={autoFocus}
        disabled={submitting}
      />
      <ComposerAttachments
        files={files}
        previewUrls={previewUrls}
        state={submitting ? 'uploading' : failed ? 'error' : 'idle'}
        progress={progress?.slices}
        onRemove={(file) => setFiles((prev) => removePendingFile(prev, file))}
        onReorder={(from, to) => setFiles((prev) => moveItem(prev, from, to))}
        groupMedia
        // Retry sends the draft, so it is only offered while there is one.
        onRetry={value.trim() ? () => void submit() : undefined}
      />
      {submitting && <UploadProgress progress={progress ?? null} />}
      <div className='flex items-center justify-end gap-2'>
        <SendShortcutHint />
        <input
          ref={fileRef}
          type='file'
          multiple
          onChange={(event) => {
            if (event.target.files) addFiles(Array.from(event.target.files))
            event.target.value = ''
          }}
          className='hidden'
        />
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              type='button'
              variant='ghost'
              size='icon'
              className='size-8'
              onClick={() => fileRef.current?.click()}
              disabled={submitting}
              aria-label={labels.attach}
            >
              <Paperclip className='size-4' />
            </Button>
          </TooltipTrigger>
          <TooltipContent>{labels.attach}</TooltipContent>
        </Tooltip>
        {onClose && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type='button'
                variant='ghost'
                size='icon'
                className='size-8'
                onClick={(event) => {
                  event.preventDefault()
                  event.stopPropagation()
                  close()
                }}
                disabled={submitting}
                aria-label={labels.cancel}
              >
                <X className='size-4' />
              </Button>
            </TooltipTrigger>
            <TooltipContent>{labels.cancel}</TooltipContent>
          </Tooltip>
        )}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              type='button'
              size='icon'
              className='size-8'
              disabled={!value.trim() || submitting}
              onClick={(event) => {
                event.preventDefault()
                event.stopPropagation()
                void submit()
              }}
              aria-label={labels.send}
            >
              {submitting ? <Loader2 className='size-4 animate-spin' /> : <Send className='size-4' />}
            </Button>
          </TooltipTrigger>
          <TooltipContent>{labels.send}</TooltipContent>
        </Tooltip>
      </div>
    </div>
  )
}
