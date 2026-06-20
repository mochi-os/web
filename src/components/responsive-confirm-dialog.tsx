// Copyright © 2026 Mochi OÜ
// SPDX-License-Identifier: Apache-2.0

'use client'

import * as React from 'react'
import { useLingui } from '@lingui/react/macro'
import { cn } from '../lib/utils'
import { Button } from './ui/button'
import {
  ResponsiveDialog,
  ResponsiveDialogClose,
  ResponsiveDialogContent,
  ResponsiveDialogDescription,
  ResponsiveDialogFooter,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
} from './ui/responsive-dialog'

type ResponsiveConfirmDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: React.ReactNode
  disabled?: boolean
  desc: React.JSX.Element | string
  cancelBtnText?: string
  confirmText?: React.ReactNode
  destructive?: boolean
  handleConfirm: () => void
  isLoading?: boolean
  className?: string
  children?: React.ReactNode
}

export function ResponsiveConfirmDialog(props: ResponsiveConfirmDialogProps) {
  const { t } = useLingui()
  const {
    title,
    desc,
    children,
    className,
    confirmText,
    cancelBtnText,
    destructive,
    isLoading,
    disabled = false,
    handleConfirm,
    open,
    onOpenChange,
  } = props

  return (
    <ResponsiveDialog
      open={open}
      onOpenChange={onOpenChange}
      shouldCloseOnInteractOutside={false}
    >
      <ResponsiveDialogContent className={cn(className)}>
        <ResponsiveDialogHeader className='text-start'>
          <ResponsiveDialogTitle>{title}</ResponsiveDialogTitle>
          <ResponsiveDialogDescription>{desc}</ResponsiveDialogDescription>
        </ResponsiveDialogHeader>
        {children}
        <ResponsiveDialogFooter className='gap-2'>
          <ResponsiveDialogClose asChild>
            <Button variant='outline' disabled={isLoading}>
              {cancelBtnText ?? t`Cancel`}
            </Button>
          </ResponsiveDialogClose>
          <Button
            variant={destructive ? 'destructive' : 'default'}
            onClick={handleConfirm}
            disabled={disabled || isLoading}
          >
            {confirmText ?? t`Continue`}
          </Button>
        </ResponsiveDialogFooter>
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  )
}
