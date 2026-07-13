// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: Apache-2.0

import * as React from 'react'
import { cn } from '../../lib/utils'

function Textarea({ className, ref, ...props }: React.ComponentProps<'textarea'>) {
  const innerRef = React.useRef<HTMLTextAreaElement | null>(null)

  const autoResize = React.useCallback((el: HTMLTextAreaElement | null) => {
    if (el) {
      el.style.height = 'auto'
      el.style.height = el.scrollHeight + 'px'
    }
  }, [])

  React.useEffect(() => {
    autoResize(innerRef.current)
  }, [props.value, autoResize])

  return (
    <textarea
      ref={(el) => {
        innerRef.current = el
        if (typeof ref === 'function') ref(el)
        else if (ref) ref.current = el
        autoResize(el)
      }}
      data-slot='textarea'
      className={cn(
        'border-border placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive dark:bg-input/30 flex min-h-16 w-full rounded-md border-[length:var(--border-width)] bg-transparent px-3 py-2 text-base shadow-xs transition-[color,box-shadow] outline-none focus-visible:ring-[3px] disabled:cursor-not-allowed disabled:opacity-50 md:text-sm',
        className
      )}
      {...props}
    />
  )
}

export { Textarea }
