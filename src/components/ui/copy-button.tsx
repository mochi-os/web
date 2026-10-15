// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: Apache-2.0

import { t } from '@lingui/core/macro'
import * as React from 'react'
import { Trans } from '@lingui/react/macro'
import { Check, Copy } from 'lucide-react'
import { type VariantProps } from 'class-variance-authority'
import { Button, buttonVariants } from './button'
import { toast } from '../../lib/toast-utils'
import { cn } from '../../lib/utils'
import { shellClipboardWrite } from '../../lib/shell-bridge'

interface CopyButtonProps
  extends
    React.ComponentProps<typeof Button>,
    VariantProps<typeof buttonVariants> {
  value: string
  successMessage?: string
  errorMessage?: string
  onCopyError?: () => void
  /** Shown until a copy succeeds, in place of the copy icon. */
  icon?: React.ReactNode
}

export function CopyButton({
  value,
  successMessage = t`Copied to clipboard`,
  errorMessage = t`Failed to copy`,
  onCopyError,
  icon,
  onClick,
  className,
  variant = 'ghost',
  size = 'icon',
  ...props
}: CopyButtonProps) {
  const [copied, setCopied] = React.useState(false)

  const handleCopy = React.useCallback(async () => {
    const ok = await shellClipboardWrite(value)
    if (ok) {
      setCopied(true)
      toast.success(successMessage)
      setTimeout(() => setCopied(false), 2000)
    } else {
      onCopyError?.()
      toast.error(errorMessage)
    }
  }, [errorMessage, onCopyError, value, successMessage])

  return (
    <Button
      variant={variant}
      size={size}
      className={cn('size-8 shrink-0', className)}
      {...props}
      // After the spread, and calling a passed handler too: a Tooltip trigger
      // injects its own onClick, which used to replace the copy entirely.
      onClick={(e) => {
        onClick?.(e)
        e.preventDefault()
        e.stopPropagation()
        handleCopy()
      }}
    >
      {copied ? (
        <Check className='h-3.5 w-3.5 text-success' />
      ) : (
        (icon ?? <Copy className='h-3.5 w-3.5' />)
      )}
      <span className='sr-only'>
        <Trans>Copy</Trans>
      </span>
    </Button>
  )
}
