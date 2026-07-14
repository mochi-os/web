// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: Apache-2.0

'use client'

import * as React from 'react'
import * as TooltipPrimitive from '@radix-ui/react-tooltip'
import { cn } from '../../lib/utils'

function TooltipProvider({
  delayDuration = 0,
  // Close on the trigger's own pointerleave instead of Radix's default
  // "hoverable content" grace area. The grace area only closes when a
  // document-level pointermove lands outside it — but our apps render inside a
  // sandboxed iframe that fills the viewport, and an iframe swallows pointermove
  // so the parent document never sees it. A tooltip on a shell/parent-window
  // trigger would then open on hover and never close. Our tooltips are plain
  // text labels, so hoverable content buys nothing.
  disableHoverableContent = true,
  ...props
}: React.ComponentProps<typeof TooltipPrimitive.Provider>) {
  return (
    <TooltipPrimitive.Provider
      data-slot='tooltip-provider'
      delayDuration={delayDuration}
      disableHoverableContent={disableHoverableContent}
      {...props}
    />
  )
}

function Tooltip({
  ...props
}: React.ComponentProps<typeof TooltipPrimitive.Root>) {
  return (
    <TooltipProvider>
      <TooltipPrimitive.Root data-slot='tooltip' {...props} />
    </TooltipProvider>
  )
}

function TooltipTrigger({
  onFocus,
  ...props
}: React.ComponentProps<typeof TooltipPrimitive.Trigger>) {
  return (
    <TooltipPrimitive.Trigger
      data-slot='tooltip-trigger'
      {...props}
      onFocus={(event) => {
        onFocus?.(event)
        // Open on hover (pointer path, untouched) and on keyboard focus, but not
        // on the programmatic focus an overlay restores to its trigger when it
        // closes — a Tooltip on a Popover/Dropdown/Dialog trigger would otherwise
        // stay stuck open after the overlay dismisses. Keyboard focus sets
        // :focus-visible; the restored focus after a pointer interaction does not.
        // Radix composes this handler before its own onOpen and skips onOpen when
        // we preventDefault, so gating here suppresses only the unwanted open.
        if (!event.defaultPrevented && !event.currentTarget.matches(':focus-visible')) {
          event.preventDefault()
        }
      }}
    />
  )
}

function TooltipContent({
  className,
  sideOffset = 0,
  children,
  ...props
}: React.ComponentProps<typeof TooltipPrimitive.Content>) {
  return (
    <TooltipPrimitive.Portal>
      <TooltipPrimitive.Content
        data-slot='tooltip-content'
        sideOffset={sideOffset}
        className={cn(
          'bg-surface-1 text-foreground border-[length:var(--border-width)] border-border-strong shadow-md animate-in fade-in-0 zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 z-[70] w-fit origin-(--radix-tooltip-content-transform-origin) rounded-md px-3 py-1.5 text-xs text-balance',
          className
        )}
        {...props}
      >
        {children}
        <TooltipPrimitive.Arrow className='bg-surface-1 fill-surface-1 z-50 size-2.5 translate-y-[calc(-50%_-_2px)] rotate-45 rounded-[2px]' />
      </TooltipPrimitive.Content>
    </TooltipPrimitive.Portal>
  )
}

export { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider }
