// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: Apache-2.0

import { Trans } from '@lingui/react/macro'
import { SlidersHorizontal } from 'lucide-react'
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover'
import { Tooltip, TooltipContent, TooltipTrigger } from './ui/tooltip'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select'
import { Skeleton } from './ui/skeleton'
import { cn, naturalCompare } from '../lib/utils'
import { t } from '@lingui/core/macro'

/**
 * Category assignment for one notification topic. lib/web ships inside every
 * app's bundle and cannot hold another app's grants, so this holds no data and
 * makes no request: the consumer supplies both.
 */
export interface NotificationCategory {
  id: number
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
  category: number | null
}

interface Props {
  /** Null while the consumer is still loading them. */
  categories: NotificationCategory[] | null
  /** The topic row this notification belongs to, or null if none exists yet. */
  topic: NotificationTopic | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onCategoryChange: (topic: NotificationTopic, category: string) => Promise<void>
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
        if (a.id === 0) return 1
        if (b.id === 0) return -1
        return naturalCompare(a.display ?? a.label, b.display ?? b.label)
      })
    : null

  const onChange = async (value: string) => {
    if (!row) return
    await onCategoryChange(row, value)
  }

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <Tooltip>
        <TooltipTrigger asChild>
          <PopoverTrigger asChild>
            <button
              type="button"
              aria-label={t`Change notification category`}
              onClick={(e) => e.stopPropagation()}
              className={cn(
                'flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-hover hover:text-foreground active:bg-interactive-active',
                className
              )}
            >
              <SlidersHorizontal className="size-3.5" />
            </button>
          </PopoverTrigger>
        </TooltipTrigger>
        <TooltipContent>{t`Change notification category`}</TooltipContent>
      </Tooltip>
      <PopoverContent
        align="end"
        className="w-64 p-3"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground"><Trans>Category for these notifications</Trans></p>
          {row && (row.label || row.topic) ? (
            <p className="text-sm font-medium">{row.label || row.topic}</p>
          ) : null}
          {!ordered ? (
            <Skeleton className="h-9 w-full" />
          ) : !row ? (
            <p className="text-xs text-muted-foreground"><Trans>No topic record yet — try again after the next notification.</Trans></p>
          ) : (
            <Select
              value={row.category != null ? String(row.category) : ''}
              onValueChange={onChange}
              disabled={saving}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder={t`Unassigned`} />
              </SelectTrigger>
              <SelectContent>
                {ordered.map((cat) => (
                  <SelectItem key={cat.id} value={String(cat.id)}>{cat.display ?? cat.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <a
            href="/settings/user/notifications"
            className="block text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
          >
            <Trans>Manage categories</Trans>
          </a>
        </div>
      </PopoverContent>
    </Popover>
  )
}
