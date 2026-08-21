// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: Apache-2.0

import { useRef, useState } from 'react'
import { ArrowLeft } from 'lucide-react'
import { useRouter } from '@tanstack/react-router'
import { Button } from '../ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '../ui/tooltip'
import { cn } from '../../lib/utils'
import { isInShell, shellNavigateBack } from '../../lib/shell-bridge'

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
  const router = useRouter()
  const [isFallbackPending, setIsFallbackPending] = useState(false)
  const isFallbackPendingRef = useRef(false)

  const handleClick = async () => {
    if (isFallbackPendingRef.current) return

    // Prefer real in-app history; the page-supplied destination is only for a
    // deep link or fresh tab. history.back() is a silent no-op inside the shell
    // iframe, so ask the shell to pop the top window's history instead.
    if (router.history.canGoBack()) {
      if (isInShell()) {
        shellNavigateBack()
      } else {
        router.history.back()
      }
      return
    }

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
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          type='button'
          variant='ghost'
          size='icon'
          onClick={() => void handleClick()}
          disabled={isFallbackPending}
          aria-label={ariaLabel ?? label}
          className={cn('shrink-0', className)}
        >
          <ArrowLeft className='size-4 shrink-0 rtl:rotate-180' />
        </Button>
      </TooltipTrigger>
      <TooltipContent>{ariaLabel ?? label}</TooltipContent>
    </Tooltip>
  )
}
