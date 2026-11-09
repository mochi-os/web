// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: Apache-2.0

import { Trans } from '@lingui/react/macro'
import { SlidersHorizontal } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from './ui/dropdown-menu'
import { Tooltip, TooltipContent, TooltipTrigger } from './ui/tooltip'
import { Skeleton } from './ui/skeleton'
import { cn, naturalCompare } from '../lib/utils'
import { t } from '@lingui/core/macro'

/**
 * Category assignment for one notification topic. lib/web ships inside every
 * app's bundle and cannot hold another app's grants, so this holds no data and
 * makes no request: the consumer supplies both.
 */
export interface NotificationCategory {
  // mochi.uid() text - 32 hex characters. The seeded "No notifications" and
  // default rows are '0' and '1'; nothing here is ever a number.
  id: string
  label: string
  // Read-time translated label for the seeded categories; label is the
  // stored value. Render display, edit label.
  display?: string
  default: number
}

export interface NotificationTopic {
  app: string
  topic: string
  object: string
  label: string
  category: string | null
}

interface Props {
  /** Null while the consumer is still loading them. */
  categories: NotificationCategory[] | null
  /** The topic row this notification belongs to, or null if none exists yet. */
  topic: NotificationTopic | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onCategoryChange: (
    topic: NotificationTopic,
    category: string
  ) => Promise<void>
  saving?: boolean
  className?: string
}

export function NotificationCategoryButton({
  categories,
  topic: row,
  open,
  onOpenChange,
  onCategoryChange,
  saving = false,
  className,
}: Props) {
  // Categories arrive already sorted by the consumer's loader? No — sorting is
  // presentation, so it stays here: default category last, the rest by name.
  const ordered = categories
    ? [...categories].sort((a, b) => {
        if (a.id === '0') return 1
        if (b.id === '0') return -1
        return naturalCompare(a.display ?? a.label, b.display ?? b.label)
      })
    : null

  const onChange = async (value: string) => {
    if (!row) return
    await onCategoryChange(row, value)
  }

  return (
    <DropdownMenu open={open} onOpenChange={onOpenChange}>
      <Tooltip>
        <TooltipTrigger asChild>
          <DropdownMenuTrigger asChild>
            <button
              type='button'
              aria-label={t`Change notification category`}
              onClick={(e) => e.stopPropagation()}
              className={cn(
                'flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-hover hover:text-foreground active:bg-interactive-active',
                className
              )}
            >
              <SlidersHorizontal className='size-3.5' />
            </button>
          </DropdownMenuTrigger>
        </TooltipTrigger>
        <TooltipContent>{t`Change notification category`}</TooltipContent>
      </Tooltip>
      <DropdownMenuContent
        align='end'
        className='min-w-48'
        onClick={(e) => e.stopPropagation()}
      >
        {!ordered ? (
          <div className='space-y-1 p-1'>
            <Skeleton className='h-7 w-full' />
            <Skeleton className='h-7 w-full' />
          </div>
        ) : !row ? (
          <p className='text-muted-foreground px-2 py-1.5 text-xs'>
            <Trans>
              No topic record yet — try again after the next notification.
            </Trans>
          </p>
        ) : (
          <DropdownMenuRadioGroup
            value={row.category != null ? String(row.category) : ''}
            onValueChange={(value) => void onChange(value)}
          >
            {ordered.map((cat) => (
              <DropdownMenuRadioItem
                key={cat.id}
                value={String(cat.id)}
                disabled={saving}
              >
                {cat.display ?? cat.label}
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <a href='/settings/user/notifications'>
            <Trans>Manage categories</Trans>
          </a>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
