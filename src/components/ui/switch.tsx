// Copyright © 2026 Mochi OÜ
// SPDX-License-Identifier: Apache-2.0

import * as React from 'react'
import * as SwitchPrimitive from '@radix-ui/react-switch'
import { cn } from '../../lib/utils'

function Switch({
  className,
  ...props
}: React.ComponentProps<typeof SwitchPrimitive.Root>) {
  return (
    <SwitchPrimitive.Root
      data-slot='switch'
      className={cn(
        'peer data-[state=checked]:bg-primary data-[state=unchecked]:bg-input focus-visible:border-ring focus-visible:ring-ring/50 dark:data-[state=unchecked]:bg-input/80 relative inline-flex h-5 w-9 shrink-0 items-center rounded-full border-[length:var(--border-width)] border-transparent shadow-xs transition-[background-color,border-color,box-shadow] outline-none focus-visible:ring-[3px] disabled:cursor-not-allowed disabled:opacity-50',
        className
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb
        data-slot='switch-thumb'
        className={cn(
          'bg-white pointer-events-none absolute start-0 top-1/2 block size-4 -translate-y-1/2 rounded-full ring-0 transition-[inset-inline-start] data-[state=checked]:start-[calc(100%-var(--spacing)*4)] data-[state=unchecked]:start-0'
        )}
      />
    </SwitchPrimitive.Root>
  )
}

export { Switch }
