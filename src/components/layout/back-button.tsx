// Copyright © 2026 Mochi OÜ
// SPDX-License-Identifier: Apache-2.0

import { useRef, useState } from 'react'
import { ArrowLeft } from 'lucide-react'
import { useRouter } from '@tanstack/react-router'
import { Button } from '../ui/button'
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

    // If the user navigated here from another in-app page, take them back
    // there. Only when there's no in-app history (deep link, fresh tab) do
    // we fall back to the page-supplied destination.
    //
    // Inside the shell iframe, history.back() is a silent no-op (opaque
    // origin, no real history entries — every push was relayed to the top
    // window via installShellNavigationSync). Ask the shell to pop the top
    // window's history instead; its popstate handler re-renders the iframe.
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
    <Button
      type='button'
      variant='ghost'
      size='icon'
      onClick={() => void handleClick()}
      disabled={isFallbackPending}
      title={label}
      aria-label={ariaLabel ?? label}
      className={cn('shrink-0', className)}
    >
      <ArrowLeft className='size-4 shrink-0 rtl:rotate-180' />
    </Button>
  )
}
