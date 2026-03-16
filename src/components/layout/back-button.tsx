import { useRef, useState } from 'react'
import { ArrowLeft } from 'lucide-react'
import { Button } from '../ui/button'
import { cn } from '../../lib/utils'

export interface HeaderBackConfig {
  label: string
  onFallback: () => void | Promise<void>
  ariaLabel?: string
  className?: string
}

export function BackButton({
  label,
  onFallback,
  ariaLabel,
  className,
}: HeaderBackConfig) {
  // Back is intentionally icon-only; contextual text is provided via aria-label/title.
  const [isFallbackPending, setIsFallbackPending] = useState(false)
  const isFallbackPendingRef = useRef(false)

  const handleClick = async () => {
    if (isFallbackPendingRef.current) return

    isFallbackPendingRef.current = true
    setIsFallbackPending(true)
    try {
      await Promise.resolve(onFallback())
    } finally {
      isFallbackPendingRef.current = false
      setIsFallbackPending(false)
    }
  }

  return (
    <Button
      type='button'
      variant='ghost'
      size='icon'
      onClick={() => void handleClick()}
      disabled={isFallbackPending}
      title={label}
      aria-label={ariaLabel ?? label}
      className={cn('size-8 shrink-0', className)}
    >
      <ArrowLeft className='size-4 shrink-0' />
    </Button>
  )
}
