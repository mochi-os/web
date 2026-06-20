// Copyright © 2026 Mochi OÜ
// SPDX-License-Identifier: Apache-2.0

import { ResponsiveConfirmDialog } from './responsive-confirm-dialog'

type ConfirmDialogProps = {
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

export function ConfirmDialog(props: ConfirmDialogProps) {
  return <ResponsiveConfirmDialog {...props} />
}
