// Copyright © 2026 Mochi OÜ
// SPDX-License-Identifier: Apache-2.0

import type { ReactNode } from 'react'
import { Minus, Plus } from 'lucide-react'
import { cn } from '../lib/utils'
import { Tooltip, TooltipContent, TooltipTrigger } from './ui/tooltip'
import { useLingui } from '@lingui/react/macro'

type CommentTreeDensity = 'compact' | 'comfortable'

export interface CommentTreeLayoutProps {
  /** Nesting depth (0 = top-level) */
  depth?: number
  /** Controls mobile spacing density for the tree layout */
  density?: CommentTreeDensity
  /** Whether the node is collapsed */
  isCollapsed: boolean
  /** Toggle collapse state */
  onToggleCollapse: () => void
  /** Whether the node has children */
  hasChildren: boolean
  /** The avatar element to display */
  avatar: ReactNode
  /** The main content (author, body, actions, etc.) */
  content: ReactNode
  /** The nested child nodes (only rendered when not collapsed) */
  children?: ReactNode
  /** Collapsed summary content (shown when collapsed) */
  collapsedContent?: ReactNode
}

export function CommentTreeLayout({
  depth = 0,
  density = 'compact',
  isCollapsed,
  onToggleCollapse,
  hasChildren,
  avatar,
  content,
  children,
  collapsedContent,
}: CommentTreeLayoutProps) {
  const { t } = useLingui()
  // Rainbow palette
  const RAINBOW_COLORS = [
    'bg-rose-400',
    'bg-amber-400',
    'bg-emerald-400',
    'bg-sky-400',
    'bg-violet-400',
  ]

  const RAINBOW_BORDERS = [
    'border-rose-400',
    'border-amber-400',
    'border-emerald-400',
    'border-sky-400',
    'border-violet-400',
  ]

  // Color for the line of THIS level
  const selfColorBg = RAINBOW_COLORS[depth % RAINBOW_COLORS.length]
  const selfColorBorder = RAINBOW_BORDERS[depth % RAINBOW_BORDERS.length]
  const isComfortable = density === 'comfortable'

  return (
    <div className='flex flex-row items-stretch'>
      {/* 1. Sidebar Column: Line + Connector + Button */}
      <div
        className={cn(
          'relative shrink-0',
          isComfortable ? 'w-5 md:w-4' : 'w-4'
        )}
      >
        <div
          className={cn(
            'absolute top-0 bottom-0 z-0 w-[2px]',
            isComfortable ? 'left-[9px] md:left-[7px]' : 'left-[7px]',
            selfColorBg
          )}
        />

        {/* Collapse/Expand Button */}
        {hasChildren && (
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type='button'
                onClick={(e) => {
                  e.stopPropagation()
                  onToggleCollapse()
                }}
                className={cn(
                  'bg-background hover:bg-hover text-muted-foreground absolute z-20 flex items-center justify-center rounded-full border transition-colors touch-manipulation focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40',
                  isComfortable
                    ? 'top-[5px] left-[3px] size-3.5 md:top-[4px] md:left-[2px] md:size-3'
                    : 'top-[4px] left-[2px] size-3',
                  selfColorBorder
                )}
                aria-label={isCollapsed ? t`Expand` : t`Collapse`}
              >
                {isCollapsed ? (
                  <Plus className='size-2' />
                ) : (
                  <Minus className='size-2' />
                )}
              </button>
            </TooltipTrigger>
            <TooltipContent>{isCollapsed ? t`Expand` : t`Collapse`}</TooltipContent>
          </Tooltip>
        )}
      </div>

      {/* 2. Main Content Column */}
      <div
        className={cn(
          'min-w-0 flex-1',
          isComfortable ? 'mb-2 md:mb-1' : 'mb-1'
        )}
      >
        {/* Header Row: Avatar + Body */}
        <div
          className={cn(
            'flex',
            isComfortable ? 'gap-2.5 pb-3 md:gap-2 md:pb-2' : 'gap-2 pb-2'
          )}
        >
          {/* Avatar Area - No longer contains the line */}
          <div
            className={cn(
              'flex shrink-0 items-center justify-center',
              isComfortable ? 'size-6 md:size-5' : 'size-5'
            )}
          >
            {avatar}
          </div>

          {/* Content Body */}
          <div className={cn('min-w-0 flex-1', isComfortable ? 'pt-0' : 'pt-0.5')}>
            <div
              className={cn(
                isComfortable &&
                  'rounded-lg bg-muted/15 px-2.5 py-1.5 md:rounded-none md:bg-transparent md:px-0 md:py-0'
              )}
            >
              {isCollapsed ? collapsedContent : content}
            </div>
          </div>
        </div>

        {/* Recursive Children - Indented by being in this column */}
        {hasChildren && !isCollapsed && (
          <div
            className={cn('w-full', isComfortable ? 'mb-3 md:mb-2' : 'mb-2')}
          >
            {children}
          </div>
        )}
      </div>
    </div>
  )
}
