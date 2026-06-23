// Sort direction toggle button
// Copyright © 2026 Mochi OÜ
// SPDX-License-Identifier: Apache-2.0

import { ArrowDown, ArrowUp } from 'lucide-react'
import { cn } from '../../lib/utils'
import { Tooltip, TooltipContent, TooltipTrigger } from './tooltip'
import { useLingui } from '@lingui/react/macro'

interface SortDirectionButtonProps {
  direction: 'asc' | 'desc'
  onToggle: () => void
  className?: string
  size?: 'sm' | 'md'
}

// Toggles between ascending and descending sort direction
export function SortDirectionButton({
  direction,
  onToggle,
  className,
  size = 'md',
}: SortDirectionButtonProps) {
  const { t } = useLingui()
  const sizeClasses = size === 'sm' ? 'h-7 w-7' : 'h-9 w-9'
  const iconSize = size === 'sm' ? 'size-3.5' : 'size-4'
  const directionLabel = direction === 'asc' ? t`Ascending` : t`Descending`

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          onClick={onToggle}
          className={cn(
            'flex items-center justify-center rounded-md border border-input bg-background transition-colors hover:bg-hover',
            sizeClasses,
            className
          )}
          aria-label={directionLabel}
        >
          {direction === 'asc' ? (
            <ArrowUp className={iconSize} />
          ) : (
            <ArrowDown className={iconSize} />
          )}
        </button>
      </TooltipTrigger>
      <TooltipContent>{directionLabel}</TooltipContent>
    </Tooltip>
  )
}
