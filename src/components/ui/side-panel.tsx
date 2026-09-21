// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: Apache-2.0

// The one shape every panel that slides in from the side shares: a header with
// the title and a close button, a body that scrolls, and an optional footer
// holding the primary button or the message field. Each panel fills the three
// slots and nothing else, so the header height, the close button, the padding
// and the width steps are the same wherever a panel opens.

import * as React from 'react'
import { t } from '@lingui/core/macro'
import { X } from 'lucide-react'
import { cn } from '../../lib/utils'
import { insideToaster } from '../../lib/toast-utils'
import { Button } from './button'
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetTitle,
} from './sheet'

// Full width below `sm`, then a step. A panel never picks its own width.
const SIZE_CLASS = {
  sm: 'sm:max-w-sm',
  md: 'sm:max-w-md',
  lg: 'sm:max-w-2xl',
  xl: 'sm:max-w-3xl',
} as const

type SidePanelSize = keyof typeof SIZE_CLASS

type SidePanelProps = Omit<
  React.ComponentProps<typeof SheetContent>,
  'side' | 'showCloseButton'
> & {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** False leaves the page behind the panel usable. */
  modal?: boolean
  size?: SidePanelSize
  /**
   * Accessible name, for a header that is not a SidePanelTitle (an editable
   * title, a picker). Already translated by the caller.
   */
  label?: React.ReactNode
  /** Read out by screen readers. Omit it when the title says enough. */
  description?: React.ReactNode
  /**
   * A tap on the dimmed page closes the panel. Off by default, because a form
   * panel would drop what was typed. A panel that only reads or picks turns
   * it on.
   */
  dismissOnOutsideClick?: boolean
}

function SidePanel({
  open,
  onOpenChange,
  modal,
  size = 'md',
  label,
  description,
  dismissOnOutsideClick = false,
  className,
  children,
  ...props
}: SidePanelProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange} modal={modal}>
      <SheetContent
        data-slot='side-panel'
        showCloseButton={false}
        className={cn('w-full gap-0 p-0', SIZE_CLASS[size], className)}
        // A toast is outside the panel by design: copying an error from it
        // must not close the panel and drop what is in it.
        onInteractOutside={(event) => {
          if (
            !dismissOnOutsideClick ||
            insideToaster(event.detail.originalEvent.target)
          ) {
            event.preventDefault()
          }
        }}
        // Radix warns when a panel has no description. Opting out is the
        // documented way to say there is none.
        {...(description ? {} : { 'aria-describedby': undefined })}
        {...props}
      >
        {label && <SheetTitle className='sr-only'>{label}</SheetTitle>}
        {description && (
          <SheetDescription className='sr-only'>{description}</SheetDescription>
        )}
        {children}
      </SheetContent>
    </Sheet>
  )
}

function SidePanelHeader({
  className,
  children,
  actions,
  ...props
}: Omit<React.ComponentProps<'div'>, 'title'> & {
  /** Buttons that sit before the close button, such as watch or delete. */
  actions?: React.ReactNode
}) {
  return (
    <div
      data-slot='side-panel-header'
      className={cn(
        'flex shrink-0 items-center gap-3 border-b px-6 py-4',
        className
      )}
      {...props}
    >
      <div className='flex min-w-0 flex-1 items-center gap-2'>{children}</div>
      {actions && (
        <div className='flex shrink-0 items-center gap-1'>{actions}</div>
      )}
      <SheetClose asChild>
        <Button
          variant='ghost'
          size='icon'
          className='size-8 shrink-0'
          aria-label={t`Close`}
        >
          <X className='size-4' />
        </Button>
      </SheetClose>
    </div>
  )
}

function SidePanelTitle({
  className,
  ...props
}: React.ComponentProps<typeof SheetTitle>) {
  return (
    <SheetTitle
      data-slot='side-panel-title'
      className={cn('min-w-0 truncate text-lg leading-tight', className)}
      {...props}
    />
  )
}

/** Scrolls on its own. A body that manages its own padding passes `p-0`. */
function SidePanelBody({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot='side-panel-body'
      className={cn('min-h-0 flex-1 overflow-y-auto p-6', className)}
      {...props}
    />
  )
}

function SidePanelFooter({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot='side-panel-footer'
      className={cn(
        'flex shrink-0 flex-col gap-2 border-t px-6 py-4',
        className
      )}
      {...props}
    />
  )
}

export {
  SidePanel,
  SidePanelHeader,
  SidePanelTitle,
  SidePanelBody,
  SidePanelFooter,
}
export type { SidePanelSize }
