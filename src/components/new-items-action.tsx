// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: Apache-2.0

import { RefreshCw } from 'lucide-react'
import { useFormat } from '../hooks/use-format'
import { Button } from './ui/button'

interface NewItemsActionProps {
  /** Items that arrived since the list was loaded and wait to be merged. Nothing renders at zero. */
  count: number
  /** Merge the waiting items into the list and clear the count. */
  onClick: () => void
  /** The count in words for a screen reader ("3 new posts"). */
  label: string
  className?: string
}

/**
 * A page header action that writes the count of waiting items beside a refresh
 * icon, in the header's own type: a pill over the content covered what was
 * being read. The number is the whole visible label, so it reads at a glance;
 * the words go to the screen reader.
 */
export function NewItemsAction({
  count,
  onClick,
  label,
  className,
}: NewItemsActionProps) {
  const { formatNumber } = useFormat()
  if (count <= 0) return null

  return (
    <Button
      variant='ghost'
      size='sm'
      onClick={onClick}
      aria-label={label}
      aria-live='polite'
      className={className}
    >
      <RefreshCw className='me-1 size-3.5' />
      {formatNumber(count)}
    </Button>
  )
}
