import * as React from 'react'
import { Check, Copy } from 'lucide-react'
import { type VariantProps } from 'class-variance-authority'
import { Button, buttonVariants } from './button'
import { toast } from '../../lib/toast-utils'
import { cn } from '../../lib/utils'
import { shellClipboardWrite } from '../../lib/shell-bridge'

interface CopyButtonProps
  extends React.ComponentProps<typeof Button>,
    VariantProps<typeof buttonVariants> {
  value: string
  successMessage?: string
  errorMessage?: string
  onCopyError?: () => void
}

export function CopyButton({
  value,
  successMessage = 'Copied to clipboard',
  errorMessage = 'Failed to copy',
  onCopyError,
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
      onClick={(e) => {
        e.preventDefault()
        e.stopPropagation()
        handleCopy()
      }}
      {...props}
    >
      {copied ? (
        <Check className="h-3.5 w-3.5 text-green-500" />
      ) : (
        <Copy className="h-3.5 w-3.5" />
      )}
      <span className="sr-only">Copy</span>
    </Button>
  )
}
