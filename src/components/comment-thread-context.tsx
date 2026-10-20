// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: Apache-2.0

import {
  createContext,
  useContext,
  useEffect,
  useRef,
  type ReactNode,
} from 'react'
import { ArrowLeft, CornerDownRight } from 'lucide-react'
import { useLingui } from '@lingui/react/macro'
import { useScreenSize } from '../hooks/use-screen-size'

export interface CommentThreadOptions {
  /**
   * Opens one comment and its replies on their own. Given, a reply deeper
   * than the depth limit is left out and "Continue this thread" opens it.
   */
  onContinue?: (commentId: string) => void
  /** The comment the thread is opened on, which is highlighted. */
  focusedId?: string
}

const CommentThreadContext = createContext<CommentThreadOptions>({})

/** Thread-wide options read by every `CommentTreeLayout` beneath it. */
export function CommentThreadProvider({
  value,
  children,
}: {
  value: CommentThreadOptions
  children: ReactNode
}) {
  return (
    <CommentThreadContext.Provider value={value}>
      {children}
    </CommentThreadContext.Provider>
  )
}

export function useCommentThread(): CommentThreadOptions {
  return useContext(CommentThreadContext)
}

// Each level costs 16-20px, so four levels keep about 200px of text on a
// 320px phone. Desktop has room for twice that before it needs the cut.
const DEPTH_LIMIT_MOBILE = 4
const DEPTH_LIMIT_DESKTOP = 8

/** How many levels of replies show before "Continue this thread". */
export function useCommentDepthLimit(): number {
  const { isMobile } = useScreenSize()
  return isMobile ? DEPTH_LIMIT_MOBILE : DEPTH_LIMIT_DESKTOP
}

/** Stands in for replies cut at the depth limit. */
export function CommentContinueThread({ onClick }: { onClick: () => void }) {
  const { t } = useLingui()
  return (
    <button
      type='button'
      onClick={onClick}
      className='text-primary mb-2 inline-flex min-h-8 items-center gap-1.5 text-xs font-medium hover:underline md:min-h-6'
    >
      {/* Mirrored, not turned: the hook still points down, toward the replies. */}
      <CornerDownRight className='size-3.5 rtl:-scale-x-100' />
      {t`Continue this thread`}
    </button>
  )
}

/**
 * Leaves a thread opened on one comment for the whole discussion. Scrolls to
 * itself whenever the thread opens on another comment, so a shared link or a
 * "Continue this thread" deep in the page lands on the comment, not the post.
 */
export function CommentThreadBack({ onClick }: { onClick: () => void }) {
  const { t } = useLingui()
  const { focusedId } = useCommentThread()
  const ref = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    ref.current?.scrollIntoView?.({ block: 'start' })
  }, [focusedId])
  return (
    <button
      ref={ref}
      type='button'
      onClick={onClick}
      // The page header is sticky, so stop below it rather than under it. It
      // measures itself into --page-header-height, as StickyBar reads it.
      className='text-primary mb-3 inline-flex min-h-8 scroll-mt-[calc(var(--sticky-top,0px)+var(--page-header-height,0px)+0.5rem)] items-center gap-1.5 text-sm font-medium hover:underline'
    >
      <ArrowLeft className='size-4 rtl:rotate-180' />
      {t`All comments`}
    </button>
  )
}
