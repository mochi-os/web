import { useState } from 'react'
import { Check, Loader2 } from 'lucide-react'
import { Button } from '../../components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../../components/ui/dialog'
import { Input } from '../../components/ui/input'
import { Label } from '../../components/ui/label'
import type { Account } from './types'

interface AccountVerifyProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  account: Account
  onVerify: (id: number, code: string) => Promise<void>
  onResend: (id: number) => Promise<void>
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
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Verify email address</DialogTitle>
            <DialogDescription>
              We sent a verification code to{' '}
              <strong>{account.identifier}</strong>. Enter the code below to
              verify your email address.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="code">Verification code</Label>
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

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={handleResend}
              disabled={isResending}
            >
              {isResending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Send again
            </Button>
            <Button
              type="submit"
              disabled={isVerifying || code.trim().length < 10}
            >
              {isVerifying ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Check className="mr-2 h-4 w-4" />
              )}
              Verify
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
