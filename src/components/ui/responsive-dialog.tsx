// Copyright © 2026 Mochi OÜ
// SPDX-License-Identifier: Apache-2.0

'use client'

import * as React from 'react'
import { cn } from '../../lib/utils'
import { useScreenSize } from '../../hooks/use-screen-size'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from './dialog'
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from './drawer'

const ResponsiveDialogContext = React.createContext<{
  shouldCloseOnInteractOutside: boolean
}>({
  shouldCloseOnInteractOutside: true,
})

interface BaseProps {
  children?: React.ReactNode
}

interface RootResponsiveDialogProps extends BaseProps {
  open?: boolean
  onOpenChange?: (open: boolean) => void
}

function ResponsiveDialog({
  children,
  shouldCloseOnInteractOutside = true,
  ...props
}: RootResponsiveDialogProps & { shouldCloseOnInteractOutside?: boolean }) {
  const { isMobile } = useScreenSize()
  const ResponsiveDialogRoot = !isMobile ? Dialog : Drawer

  return (
    <ResponsiveDialogContext.Provider value={{ shouldCloseOnInteractOutside }}>
      <ResponsiveDialogRoot
        {...props}
        // Always allow mobile drawers to be dismissible for better UX
        // The shouldCloseOnInteractOutside setting only affects desktop/tablet dialogs
        {... (isMobile && { dismissible: true })}
      >
        {children}
      </ResponsiveDialogRoot>
    </ResponsiveDialogContext.Provider>
  )
}

function ResponsiveDialogTrigger({
  className,
  children,
  ...props
}: BaseProps & { className?: string; asChild?: boolean }) {
  const { isMobile } = useScreenSize()
  const ResponsiveDialogTriggerComponent = !isMobile
    ? DialogTrigger
    : DrawerTrigger

  return (
    <ResponsiveDialogTriggerComponent className={className} {...props}>
      {children}
    </ResponsiveDialogTriggerComponent>
  )
}

function ResponsiveDialogClose({
  className,
  children,
  ...props
}: BaseProps & { className?: string; asChild?: boolean }) {
  const { isMobile } = useScreenSize()
  const ResponsiveDialogCloseComponent = !isMobile ? DialogClose : DrawerClose

  return (
    <ResponsiveDialogCloseComponent className={className} {...props}>
      {children}
    </ResponsiveDialogCloseComponent>
  )
}

function ResponsiveDialogContent({
  className,
  children,
  bodyPadding = true,
  showCloseButton,
  onInteractOutside,
  ...props
}: BaseProps & { className?: string } & React.ComponentProps<
    typeof DialogContent
  > & {
    bodyPadding?: boolean
  }) {
  const { isMobile } = useScreenSize()
  const ResponsiveDialogContentComponent = !isMobile
    ? DialogContent
    : DrawerContent
  const { shouldCloseOnInteractOutside } = React.useContext(
    ResponsiveDialogContext
  )

  return (
    <ResponsiveDialogContentComponent
      className={cn(
        className,
        isMobile &&
          bodyPadding &&
          "data-[vaul-drawer-direction=bottom]:[&>[data-slot=drawer-header]+*:not(form):not([data-slot=drawer-footer])]:px-4 data-[vaul-drawer-direction=bottom]:[&_form>[data-slot=drawer-header]+*:not([data-slot=drawer-footer])]:px-4"
      )}
      {...(props as any)}
      {...(!isMobile && {
        showCloseButton,
        onInteractOutside: (e: any) => {
          if (!shouldCloseOnInteractOutside) {
            e.preventDefault()
          }
          onInteractOutside?.(e)
        },
      })}
    >
      {children}
    </ResponsiveDialogContentComponent>
  )
}

function ResponsiveDialogDescription({
  className,
  children,
  ...props
}: BaseProps & { className?: string }) {
  const { isMobile } = useScreenSize()
  const ResponsiveDialogDescriptionComponent = !isMobile
    ? DialogDescription
    : DrawerDescription

  return (
    <ResponsiveDialogDescriptionComponent className={className} {...props}>
      {children}
    </ResponsiveDialogDescriptionComponent>
  )
}

function ResponsiveDialogHeader({
  className,
  children,
  ...props
}: BaseProps & { className?: string }) {
  const { isMobile } = useScreenSize()
  const ResponsiveDialogHeaderComponent = !isMobile
    ? DialogHeader
    : DrawerHeader

  return (
    <ResponsiveDialogHeaderComponent className={className} {...props}>
      {children}
    </ResponsiveDialogHeaderComponent>
  )
}

function ResponsiveDialogTitle({
  className,
  children,
  ...props
}: BaseProps & { className?: string }) {
  const { isMobile } = useScreenSize()
  const ResponsiveDialogTitleComponent = !isMobile ? DialogTitle : DrawerTitle

  return (
    <ResponsiveDialogTitleComponent className={className} {...props}>
      {children}
    </ResponsiveDialogTitleComponent>
  )
}

function ResponsiveDialogFooter({
  className,
  children,
  ...props
}: BaseProps & { className?: string }) {
  const { isMobile } = useScreenSize()
  const ResponsiveDialogFooterComponent = !isMobile
    ? DialogFooter
    : DrawerFooter

  return (
    <ResponsiveDialogFooterComponent className={className} {...props}>
      {children}
    </ResponsiveDialogFooterComponent>
  )
}

export {
  ResponsiveDialog,
  ResponsiveDialogTrigger,
  ResponsiveDialogClose,
  ResponsiveDialogContent,
  ResponsiveDialogDescription,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
  ResponsiveDialogFooter,
}
