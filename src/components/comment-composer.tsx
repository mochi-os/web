// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: Apache-2.0

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { t } from '@lingui/core/macro'
import { ConfirmDialog } from './confirm-dialog'
import {
  AttachmentComposer,
  type AttachmentComposerProps,
  type ComposerFileState,
} from './attachment-composer'
import { pendingFileKey } from '../lib/attachment-utils'
import type { UploadSlice } from '../lib/upload-slices'
import { toast } from '../lib/toast-utils'
import { cn } from '../lib/utils'

const isMacPlatform = () =>
  typeof navigator !== 'undefined' &&
  /Mac|iPhone|iPad|iPod/.test(navigator.userAgent)

const COARSE_POINTER = '(hover: none) and (pointer: coarse)'

/**
 * False on phones and tablets, where there is no key to press and the
 * shortcut chip is just noise. Reads the query up front so the hint never
 * flashes in before it is hidden.
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
 * Send shortcut chip. Decorative only — the Send button already carries the
 * accessible name, so this stays out of the accessibility tree (and out of the
 * message catalogs).
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
 * Fails a send before it starts when the browser knows it has no network.
 *
 * Without this the request just sits there spinning — uploads deliberately
 * carry no timeout — and only completes once the connection comes back.
 * Returns true when the send was blocked and already reported.
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
 * Drag-and-drop and paste-to-attach for a composer.
 *
 * Spread `dropzoneProps` on the element that wraps the text field and the
 * attachment list. Paste rides on the same element: it bubbles up from the
 * focused textarea, and the event is only swallowed when the clipboard
 * actually carries files, so pasting text is untouched.
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
   * Per-file upload progress, index-aligned with `files`. Safe to align by
   * index here: every caller of this wrapper stages the same array it uploads.
   * A composer whose list differs from its body — chat, the post edit forms —
   * uses `AttachmentComposer` directly and maps by key.
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
}

/**
 * `File[]` convenience wrapper around `AttachmentComposer`, for the composers
 * that stage plain files and nothing else. Anything holding a richer item —
 * the edit forms with their saved-and-new mix, chat with its voice notes —
 * maps onto `ComposerItem` and uses `AttachmentComposer` directly.
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
}: ComposerAttachmentsProps) {
  const items = useMemo(
    () =>
      files.map((file, i) => ({
        key: pendingFileKey(file),
        name: file.name,
        size: file.size,
        type: file.type,
        previewUrl: file.type.startsWith('image/') ? previewUrls[i] : null,
        progress: progress?.[i],
      })),
    [files, previewUrls, progress]
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
      onRetry={onRetry}
    />
  )
}

/**
 * Guards closing a composer that still holds a draft.
 *
 * `requestClose` closes straight away when there is nothing to lose, asks
 * first when there is, and does nothing at all while a send is in flight —
 * which is what stops Escape from throwing away a comment mid-request.
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
