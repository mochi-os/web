// Sort direction toggle button
// Copyright Alistair Cunningham 2026

import { ArrowDown, ArrowUp } from 'lucide-react'
import { cn } from '../../lib/utils'

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
  const sizeClasses = size === 'sm' ? 'h-7 w-7' : 'h-9 w-9'
  const iconSize = size === 'sm' ? 'size-3.5' : 'size-4'

  return (
    <button
      type="button"
      onClick={onToggle}
      className={cn(
        'flex items-center justify-center rounded-md border border-input bg-background transition-colors hover:bg-hover',
        sizeClasses,
        className
      )}
      title={direction === 'asc' ? "Ascending" : "Descending"}
    >
      {direction === 'asc' ? (
        <ArrowUp className={iconSize} />
      ) : (
        <ArrowDown className={iconSize} />
      )}
    </button>
  )
}
