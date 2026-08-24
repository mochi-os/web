// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: Apache-2.0

import { createContext, useContext, type ComponentProps, type ReactNode } from 'react'
import { cn } from '../lib/utils'

export type ActionPillHoverGroup = 'card' | 'row' | 'bubble'

type ActionPillContextValue = {
  sticky: boolean
  hoverGroup: ActionPillHoverGroup
  expandWidth: 200 | 300
  /** When sticky, expand ActionPillActions on hover. When false, actions always visible. */
  expandActions: boolean
}

const ActionPillContext = createContext<ActionPillContextValue | null>(null)

function useActionPillContext(component: string) {
  const ctx = useContext(ActionPillContext)
  if (!ctx) {
    throw new Error(`${component} must be used within ActionPill`)
  }
  return ctx
}

// Full static class strings so Tailwind JIT keeps them (no dynamic fragments).
const EXPAND_MAX_W = {
  card: {
    200: 'md:max-w-0 md:opacity-0 md:pointer-events-none md:group-hover/card:max-w-[200px] md:group-hover/card:opacity-100 md:group-hover/card:pointer-events-auto md:group-focus-within/card:max-w-[200px] md:group-focus-within/card:opacity-100 md:group-focus-within/card:pointer-events-auto md:has-[[data-state=open]]:max-w-[200px] md:has-[[data-state=open]]:opacity-100 md:has-[[data-state=open]]:pointer-events-auto',
    300: 'md:max-w-0 md:opacity-0 md:pointer-events-none md:group-hover/card:max-w-[300px] md:group-hover/card:opacity-100 md:group-hover/card:pointer-events-auto md:group-focus-within/card:max-w-[300px] md:group-focus-within/card:opacity-100 md:group-focus-within/card:pointer-events-auto md:has-[[data-state=open]]:max-w-[300px] md:has-[[data-state=open]]:opacity-100 md:has-[[data-state=open]]:pointer-events-auto',
  },
  row: {
    200: 'md:max-w-0 md:opacity-0 md:pointer-events-none md:overflow-hidden md:group-hover/row:max-w-[200px] md:group-hover/row:opacity-100 md:group-hover/row:pointer-events-auto md:group-focus-within/row:max-w-[200px] md:group-focus-within/row:opacity-100 md:group-focus-within/row:pointer-events-auto md:has-[[data-state=open]]:max-w-[200px] md:has-[[data-state=open]]:opacity-100 md:has-[[data-state=open]]:pointer-events-auto',
    300: 'md:max-w-0 md:opacity-0 md:pointer-events-none md:overflow-hidden md:group-hover/row:max-w-[300px] md:group-hover/row:opacity-100 md:group-hover/row:pointer-events-auto md:group-focus-within/row:max-w-[300px] md:group-focus-within/row:opacity-100 md:group-focus-within/row:pointer-events-auto md:has-[[data-state=open]]:max-w-[300px] md:has-[[data-state=open]]:opacity-100 md:has-[[data-state=open]]:pointer-events-auto',
  },
  bubble: {
    200: 'max-w-0 overflow-hidden opacity-0 group-hover/bubble:max-w-[200px] group-hover/bubble:opacity-100 group-data-[active=true]/bubble:max-w-[200px] group-data-[active=true]/bubble:opacity-100 focus-within:max-w-[200px] focus-within:opacity-100 has-[[data-state=open]]:max-w-[200px] has-[[data-state=open]]:opacity-100 transition-all duration-200 ease-out',
    300: 'max-w-0 overflow-hidden opacity-0 group-hover/bubble:max-w-[300px] group-hover/bubble:opacity-100 group-data-[active=true]/bubble:max-w-[300px] group-data-[active=true]/bubble:opacity-100 focus-within:max-w-[300px] focus-within:opacity-100 has-[[data-state=open]]:max-w-[300px] has-[[data-state=open]]:opacity-100 transition-all duration-200 ease-out',
  },
} as const

const EXPAND_OPACITY = {
  card: 'md:pointer-events-none md:opacity-0 md:group-hover/card:pointer-events-auto md:group-hover/card:opacity-100 md:group-focus-within/card:pointer-events-auto md:group-focus-within/card:opacity-100 md:has-[[data-state=open]]:pointer-events-auto md:has-[[data-state=open]]:opacity-100',
  row: 'md:pointer-events-none md:opacity-0 md:group-hover/row:pointer-events-auto md:group-hover/row:opacity-100 md:group-focus-within/row:pointer-events-auto md:group-focus-within/row:opacity-100 md:has-[[data-state=open]]:pointer-events-auto md:has-[[data-state=open]]:opacity-100',
  bubble:
    'opacity-0 group-hover/bubble:opacity-100 group-data-[active=true]/bubble:opacity-100 focus-within:opacity-100 has-[[data-state=open]]:opacity-100 transition-opacity',
} as const

// The container is a plain row: transient actions render bare (per-button
// hover feedback only). The pill shell lives on ActionPillSticky, so stored
// state (reaction chips, votes) keeps the chip idiom while actions carry no
// background of their own.
const INLINE_BASE = 'inline-flex shrink-0 items-center gap-1 leading-none'

const STICKY_SHELL =
  'rounded-full border border-border/50 bg-muted/40 p-0.5 shadow-sm'

type ActionPillProps = ComponentProps<'div'> & {
  /** Sticky content present (reactions/votes) — shell stays open; actions may expand. */
  sticky?: boolean
  hoverGroup?: ActionPillHoverGroup
  /** Expand max-width for hover-reveal actions / empty shell. */
  expandWidth?: 200 | 300
  /**
   * When !sticky, how the empty shell reveals on desktop: width, fade, or
   * always.
   */
  emptyReveal?: 'max-width' | 'opacity' | 'none'
  /** When sticky, whether ActionPillActions expand on hover (default true). */
  expandActions?: boolean
  children: ReactNode
}

function ActionPill({
  sticky = false,
  hoverGroup = 'card',
  expandWidth = 300,
  emptyReveal = 'max-width',
  expandActions = true,
  className,
  children,
  ...props
}: ActionPillProps) {
  const shellClass = sticky
    ? INLINE_BASE
    : emptyReveal === 'none'
      ? INLINE_BASE
      : emptyReveal === 'opacity'
        ? cn(INLINE_BASE, 'transition-opacity pointer-events-auto opacity-100', EXPAND_OPACITY[hoverGroup])
        : cn(
            INLINE_BASE,
            'overflow-hidden transition-all duration-200 max-w-full opacity-100 pointer-events-auto',
            EXPAND_MAX_W[hoverGroup][expandWidth]
          )

  return (
    <ActionPillContext.Provider
      value={{ sticky, hoverGroup, expandWidth, expandActions: sticky ? expandActions : false }}
    >
      <div data-slot='action-pill' className={cn(shellClass, className)} {...props}>
        {children}
      </div>
    </ActionPillContext.Provider>
  )
}

type ActionPillStickyProps = ComponentProps<'div'>

function ActionPillSticky({ className, children, ...props }: ActionPillStickyProps) {
  useActionPillContext('ActionPillSticky')
  if (!children) return null
  return (
    <div
      data-slot='action-pill-sticky'
      className={cn('flex items-center gap-0.5 leading-none', STICKY_SHELL, className)}
      {...props}
    >
      {children}
    </div>
  )
}

type ActionPillActionsProps = ComponentProps<'div'> & {
  /** Force always-visible actions even when parent is sticky. */
  alwaysVisible?: boolean
}

function ActionPillActions({
  className,
  children,
  alwaysVisible,
  ...props
}: ActionPillActionsProps) {
  const { sticky, hoverGroup, expandWidth, expandActions } = useActionPillContext('ActionPillActions')
  const shouldExpand = alwaysVisible ? false : sticky && expandActions

  return (
    <div
      data-slot='action-pill-actions'
      className={cn(
        'flex items-center gap-0.5 leading-none',
        shouldExpand &&
          cn(
            'overflow-hidden transition-all duration-200 max-w-full opacity-100 pointer-events-auto',
            EXPAND_MAX_W[hoverGroup][expandWidth]
          ),
        className
      )}
      {...props}
    >
      {children}
    </div>
  )
}

export { ActionPill, ActionPillSticky, ActionPillActions }
export {
  EXPAND_MAX_W as actionPillExpandMaxWidthMap,
  EXPAND_OPACITY as actionPillExpandOpacityMap,
}
