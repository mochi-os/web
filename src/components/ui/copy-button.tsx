import * as React from 'react'
import { Check, Copy } from 'lucide-react'
import { type VariantProps } from 'class-variance-authority'
import { Button, buttonVariants } from './button'
import { toast } from '../../lib/toast-utils'
import { cn } from '../../lib/utils'

interface CopyButtonProps
  extends React.ComponentProps<typeof Button>,
    VariantProps<typeof buttonVariants> {
  value: string
  successMessage?: string
}

export function CopyButton({
  value,
  successMessage = 'Copied to clipboard',
  className,
  variant = 'ghost',
  size = 'icon',
  ...props
}: CopyButtonProps) {
  const [copied, setCopied] = React.useState(false)

  const handleCopy = React.useCallback(async () => {
    try {
      // Try modern Clipboard API first
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(value)
        setCopied(true)
        toast.success(successMessage)
        setTimeout(() => setCopied(false), 2000)
      } else {
        // Fallback for non-secure contexts or older browsers
        const textArea = document.createElement('textarea')
        textArea.value = value
        textArea.style.position = 'fixed'
        textArea.style.left = '-999999px'
        textArea.style.top = '-999999px'
        document.body.appendChild(textArea)
        textArea.focus()
        textArea.select()
        
        const successful = document.execCommand('copy')
        document.body.removeChild(textArea)
        
        if (successful) {
          setCopied(true)
          toast.success(successMessage)
          setTimeout(() => setCopied(false), 2000)
        } else {
          toast.error('Failed to copy')
        }
      }
    } catch (_err) {
      // Final fallback attempt
      try {
        const textArea = document.createElement('textarea')
        textArea.value = value
        textArea.style.position = 'fixed'
        textArea.style.left = '-999999px'
        textArea.style.top = '-999999px'
        document.body.appendChild(textArea)
        textArea.focus()
        textArea.select()
        
        const successful = document.execCommand('copy')
        document.body.removeChild(textArea)
        
        if (successful) {
          setCopied(true)
          toast.success(successMessage)
          setTimeout(() => setCopied(false), 2000)
        } else {
          toast.error('Failed to copy')
        }
      } catch (_fallbackErr) {
        toast.error('Failed to copy')
      }
    }
  }, [value, successMessage])

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
