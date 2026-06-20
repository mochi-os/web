// Copyright © 2026 Mochi OÜ
// SPDX-License-Identifier: Apache-2.0

import * as React from 'react'
import { cn } from '../../lib/utils'

function Slider({
  className,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      type='range'
      className={cn(
        'h-1.5 w-full cursor-pointer rounded-full accent-primary disabled:cursor-not-allowed disabled:opacity-50',
        className
      )}
      {...props}
    />
  )
}

export { Slider }
