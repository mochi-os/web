// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: Apache-2.0

import * as React from 'react'
import { Drawer as DrawerPrimitive } from 'vaul'
import { cn } from '../../lib/utils'
import { insideToaster } from '../../lib/toast-utils'

function Drawer({
  ...props
}: React.ComponentProps<typeof DrawerPrimitive.Root>) {
  // Disable vaul's built-in input repositioning; we handle keyboard offset
  // ourselves via visualViewport in DrawerContent to avoid conflicting scrolls.
  return (
    <DrawerPrimitive.Root
      data-slot='drawer'
      repositionInputs={false}
      {...props}
    />
  )
}

function DrawerTrigger({
  ...props
}: React.ComponentProps<typeof DrawerPrimitive.Trigger>) {
  return <DrawerPrimitive.Trigger data-slot='drawer-trigger' {...props} />
}

function DrawerPortal({
  ...props
}: React.ComponentProps<typeof DrawerPrimitive.Portal>) {
  return <DrawerPrimitive.Portal data-slot='drawer-portal' {...props} />
}

function DrawerClose({
  ...props
}: React.ComponentProps<typeof DrawerPrimitive.Close>) {
  return <DrawerPrimitive.Close data-slot='drawer-close' {...props} />
}

function DrawerOverlay({
  className,
  ...props
}: React.ComponentProps<typeof DrawerPrimitive.Overlay>) {
  return (
    <DrawerPrimitive.Overlay
      data-slot='drawer-overlay'
      className={cn(
        'data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 fixed inset-0 z-[60] bg-black/50',
        className
      )}
      {...props}
    />
  )
}

function DrawerContent({
  className,
  children,
  onPointerDownOutside,
  ...props
}: React.ComponentProps<typeof DrawerPrimitive.Content>) {
  const ref =
    React.useRef<React.ComponentRef<typeof DrawerPrimitive.Content>>(null)

  React.useEffect(() => {
    const vv = window.visualViewport
    if (!vv) return

    const onViewportChange = () => {
      if (!ref.current) return
      // Keyboard height = layout viewport height minus the visible area height
      // (offsetTop accounts for any top-level page scroll on desktop)
      const keyboardHeight = Math.max(
        0,
        window.innerHeight - vv.height - vv.offsetTop
      )
      ref.current.style.bottom = keyboardHeight > 0 ? `${keyboardHeight}px` : ''
    }

    vv.addEventListener('resize', onViewportChange)
    vv.addEventListener('scroll', onViewportChange)
    return () => {
      vv.removeEventListener('resize', onViewportChange)
      vv.removeEventListener('scroll', onViewportChange)
    }
  }, [])

  return (
    <DrawerPortal data-slot='drawer-portal'>
      <DrawerOverlay />
      <DrawerPrimitive.Content
        ref={ref}
        data-slot='drawer-content'
        className={cn(
          // Drawers must sit above sheets/dialogs so mobile confirm flows opened
          // from existing panels remain visible and interactive.
          // No padding here: DrawerHeader and DrawerFooter each own a single
          // p-4 (matching SheetHeader/SheetFooter), and the three selectors
          // below give the same 16px inset to whatever body content sits
          // between them, so header, body and footer line up on one edge
          // instead of stacking padding on top of a parent padding. Three
          // shapes exist in the wild: header, plain body, footer as siblings;
          // a form wrapping all three; and a form that wraps only the body
          // and footer while the header sits outside it (CreateEntityDialog
          // and its five app copies) - the third pads the form's own
          // children instead of the form, so the footer nested inside it
          // is not padded twice.
          'group/drawer-content bg-background fixed z-[60] flex h-auto flex-col overflow-y-auto',
          '[&>[data-slot=drawer-header]+*:not(form):not([data-slot=drawer-footer])]:px-4',
          '[&_form>[data-slot=drawer-header]+*:not([data-slot=drawer-footer])]:px-4',
          '[&>[data-slot=drawer-header]+form>*:not([data-slot=drawer-footer])]:px-4',
          'data-[vaul-drawer-direction=top]:inset-x-0 data-[vaul-drawer-direction=top]:top-0 data-[vaul-drawer-direction=top]:mb-24 data-[vaul-drawer-direction=top]:max-h-[80dvh] data-[vaul-drawer-direction=top]:rounded-b-lg data-[vaul-drawer-direction=top]:border-b',
          'data-[vaul-drawer-direction=bottom]:inset-x-0 data-[vaul-drawer-direction=bottom]:bottom-0 data-[vaul-drawer-direction=bottom]:mt-24 data-[vaul-drawer-direction=bottom]:max-h-[80dvh] data-[vaul-drawer-direction=bottom]:rounded-t-lg data-[vaul-drawer-direction=bottom]:border-t data-[vaul-drawer-direction=bottom]:pb-[env(safe-area-inset-bottom)]',
          'data-[vaul-drawer-direction=right]:inset-y-0 data-[vaul-drawer-direction=right]:right-0 data-[vaul-drawer-direction=right]:w-3/4 data-[vaul-drawer-direction=right]:border-s data-[vaul-drawer-direction=right]:sm:max-w-sm',
          'data-[vaul-drawer-direction=left]:inset-y-0 data-[vaul-drawer-direction=left]:left-0 data-[vaul-drawer-direction=left]:w-3/4 data-[vaul-drawer-direction=left]:border-e data-[vaul-drawer-direction=left]:sm:max-w-sm',
          className
        )}
        onPointerDownOutside={(event) => {
          if (insideToaster(event.detail.originalEvent.target))
            event.preventDefault()
          onPointerDownOutside?.(event)
        }}
        {...props}
      >
        <div className='bg-muted mx-auto mt-2 mb-1 hidden h-1.5 w-9 shrink-0 rounded-full group-data-[vaul-drawer-direction=bottom]/drawer-content:block' />
        {children}
      </DrawerPrimitive.Content>
    </DrawerPortal>
  )
}

function DrawerHeader({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot='drawer-header'
      className={cn(
        // Sticky, not just a normal flex item: DrawerContent scrolls as one
        // box once content is taller than the sheet, and without this the
        // title scrolls away with everything else instead of staying put.
        'bg-background sticky top-0 z-10 flex flex-col gap-0.5 p-4 group-data-[vaul-drawer-direction=bottom]/drawer-content:text-center group-data-[vaul-drawer-direction=top]/drawer-content:text-center md:gap-1.5 md:text-start',
        className
      )}
      {...props}
    />
  )
}

function DrawerFooter({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot='drawer-footer'
      className={cn(
        // Sticky, not just mt-auto: mt-auto only pins the footer to the
        // bottom of a sheet short enough to have spare room. Once a form is
        // tall enough that DrawerContent itself scrolls, mt-auto stops
        // helping and the buttons end up below the fold - sticky is what
        // keeps Cancel/Submit visible at the bottom of the scrolled viewport
        // instead of requiring a scroll to reach them.
        'bg-background sticky bottom-0 z-10 mt-auto flex flex-col gap-2 p-4',
        className
      )}
      {...props}
    />
  )
}

function DrawerTitle({
  className,
  ...props
}: React.ComponentProps<typeof DrawerPrimitive.Title>) {
  return (
    <DrawerPrimitive.Title
      data-slot='drawer-title'
      className={cn('text-foreground font-semibold', className)}
      {...props}
    />
  )
}

function DrawerDescription({
  className,
  ...props
}: React.ComponentProps<typeof DrawerPrimitive.Description>) {
  return (
    <DrawerPrimitive.Description
      data-slot='drawer-description'
      className={cn('text-muted-foreground text-sm', className)}
      {...props}
    />
  )
}

export {
  Drawer,
  DrawerTrigger,
  DrawerClose,
  DrawerContent,
  DrawerHeader,
  DrawerFooter,
  DrawerTitle,
  DrawerDescription,
}
