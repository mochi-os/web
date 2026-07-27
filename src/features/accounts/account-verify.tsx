// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: Apache-2.0

import { useState } from 'react'
import { Trans } from '@lingui/react/macro'
import { Check, Loader2 } from 'lucide-react'
import { Button } from '../../components/ui/button'
import {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogDescription,
  ResponsiveDialogFooter,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
} from '../../components/ui/responsive-dialog'
import { Input } from '../../components/ui/input'
import { Label } from '../../components/ui/label'
import type { Account } from './types'

interface AccountVerifyProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  account: Account
  onVerify: (id: string, code: string) => Promise<void>
  onResend: (id: string) => Promise<void>
  isVerifying: boolean
}

export function AccountVerify({
  open,
  onOpenChange,
  account,
  onVerify,
  onResend,
  isVerifying,
}: AccountVerifyProps) {
  const [code, setCode] = useState('')
  const [isResending, setIsResending] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (code.trim()) {
      await onVerify(account.id, code.trim())
    }
  }

  const handleResend = async () => {
    setIsResending(true)
    try {
      await onResend(account.id)
    } finally {
      setIsResending(false)
    }
  }

  return (
    <ResponsiveDialog open={open} onOpenChange={onOpenChange}>
      <ResponsiveDialogContent className="sm:max-w-[425px]">
        <form onSubmit={handleSubmit}>
          <ResponsiveDialogHeader>
            <ResponsiveDialogTitle><Trans>Verify email address</Trans></ResponsiveDialogTitle>
            <ResponsiveDialogDescription>
              <Trans>
                We sent a verification code to{' '}
                <strong>{account.identifier}</strong>. Enter the code below to
                verify your email address.
              </Trans>
            </ResponsiveDialogDescription>
          </ResponsiveDialogHeader>

          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="code"><Trans>Verification code</Trans></Label>
              <Input
                id="code"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                autoComplete="one-time-code"
                className="font-mono text-center text-lg tracking-wider"
                maxLength={10}
              />
            </div>
          </div>

          <ResponsiveDialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              <Trans>Cancel</Trans>
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={handleResend}
              disabled={isResending}
            >
              {isResending && <Loader2 className="me-2 h-4 w-4 animate-spin" />}
              <Trans>Send again</Trans>
            </Button>
            <Button
              type="submit"
              disabled={isVerifying || code.trim().length < 10}
            >
              {isVerifying ? (
                <Loader2 className="me-2 h-4 w-4 animate-spin" />
              ) : (
                <Check className="me-2 h-4 w-4" />
              )}
              <Trans>Verify</Trans>
            </Button>
          </ResponsiveDialogFooter>
        </form>
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  )
}
