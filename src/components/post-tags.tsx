// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: Apache-2.0

import { useState, useRef, useEffect } from 'react'
import { cn } from '../lib/utils'
import { createPortal } from 'react-dom'
import { Minus, Plus, Tag as TagIcon, X } from 'lucide-react'
import { Popover, PopoverTrigger, PopoverContent } from './ui/popover'
import { Tooltip, TooltipContent, TooltipTrigger } from './ui/tooltip'
import { t } from '@lingui/core/macro'

export interface PostTag {
  id: string
  label: string
  qid?: string
  relevance?: number
  interest?: number
}

// Diverging interest scale: red (−) ↔ grey (0) ↔ green (+). Hue carries the
// sign, saturation the strength, so neutral reads as plain grey rather than a
// colour you have to interpret. Used for tag text and the settings slider.
export function interestColor(weight: number): string {
  const magnitude = Math.min(1, Math.abs(weight) / 100)
  const hue = weight >= 0 ? 145 : 4
  return `hsl(${hue}, ${Math.round(6 + magnitude * 72)}%, ${Math.round(50 - magnitude * 3)}%)`
}

interface PostTagsTooltipProps {
  tags: PostTag[]
  onFilter?: (label: string) => void
  onAdd?: (label: string) => Promise<void> | void
  onInterestUp?: (qidOrLabel: string, isLabel?: boolean) => void
  onInterestDown?: (qidOrLabel: string, isLabel?: boolean) => void
  onInterestRemove?: (qid: string) => void
}

interface PostTagsProps {
  tags: PostTag[]
  onFilter?: (label: string) => void
  onInterestUp?: (qidOrLabel: string, isLabel?: boolean) => void
  onInterestDown?: (qidOrLabel: string, isLabel?: boolean) => void
  onInterestRemove?: (qid: string) => void
}

const TAG_PATTERN = /^[a-z0-9 /-]+$/

export function PostTagsTooltip({ tags, onFilter, onAdd, onInterestUp, onInterestDown, onInterestRemove }: PostTagsTooltipProps) {
  const [open, setOpen] = useState(false)
  const [value, setValue] = useState('')
  const [error, setError] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 0)
    } else {
      setValue('')
      setError('')
    }
  }, [open])

  const submit = async () => {
    setError('')
    const cleaned = value.trim().toLowerCase()
    if (!cleaned) return
    if (cleaned.length > 50) {
      setError(t`Tag must be 50 characters or less`)
      return
    }
    if (!TAG_PATTERN.test(cleaned)) {
      setError(t`Letters, numbers, spaces, and hyphens only`)
      return
    }
    if (tags.some((t) => t.label === cleaned)) {
      setError(t`Tag already exists`)
      setValue('')
      return
    }
    try {
      await onAdd?.(cleaned)
      setValue('')
    } catch {
      // Parent handles error display
    }
  }

  if (tags.length === 0 && !onAdd) return null

  return (
    <Popover open={open} onOpenChange={setOpen}>
      {open && createPortal(
        <div className="fixed inset-0 z-[59]" onPointerDown={(e) => { e.preventDefault(); setOpen(false) }} />,
        document.body
      )}
      <Tooltip>
        <TooltipTrigger asChild>
          <PopoverTrigger asChild>
            <button
              type='button'
              aria-label={t`Tags`}
              className={cn(
                'inline-flex items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-foreground/10 hover:text-foreground active:bg-interactive-active',
                tags.length > 0 ? 'min-w-7 h-7 px-1.5 gap-1 text-xs' : 'size-7'
              )}
              onClick={(e) => {
                e.stopPropagation()
              }}
            >
              <TagIcon className='size-4' />
              {tags.length > 0 && <span>{tags.length}</span>}
            </button>
          </PopoverTrigger>
        </TooltipTrigger>
        <TooltipContent>{t`Tags`}</TooltipContent>
      </Tooltip>
      <PopoverContent
        className='w-auto min-w-[160px] max-w-[320px] p-2'
        align='start'
        onPointerDown={(e) => e.stopPropagation()}
        onClick={(e) => e.stopPropagation()}
      >
        <PostTags tags={tags} onFilter={onFilter} onInterestUp={onInterestUp} onInterestDown={onInterestDown} onInterestRemove={onInterestRemove} />
        <div className={tags.length > 0 ? 'mt-1.5 border-t pt-1.5' : ''}>
          <input
            ref={inputRef}
            type='text'
            value={value}
            onChange={(e) => { setValue(e.target.value); setError('') }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                submit()
              }
            }}
            className='text-foreground placeholder:text-muted-foreground h-7 w-full bg-transparent text-sm outline-none'
            placeholder={t`Add tag...`}
          />
          {error && <p className='text-destructive text-xs'>{error}</p>}
        </div>
      </PopoverContent>
    </Popover>
  )
}

export function PostTags({ tags, onFilter, onInterestUp, onInterestDown, onInterestRemove }: PostTagsProps) {
  const [adjustments, setAdjustments] = useState<Record<string, number | null>>({})

  if (!tags.length) return null

  return (
    <div className='flex flex-col gap-1'>
      {tags.map((tag) => {
        const adjusted = tag.qid && tag.qid in adjustments
        const interest = adjusted ? adjustments[tag.qid!] : tag.interest
        return (
        <div
          key={tag.id}
          className='group/tag flex items-center gap-1 text-sm'
        >
          <button
            type='button'
            className='hover:underline truncate text-start'
            onClick={(e) => {
              e.preventDefault()
              e.stopPropagation()
              onFilter?.(tag.label)
            }}
            title={tag.relevance != null && interest != null ? `Relevance ${tag.relevance}, interest ${interest}` : tag.relevance != null ? `Relevance ${tag.relevance}` : interest != null ? `Interest ${interest}` : undefined}
            style={interest != null ? { color: interestColor(interest) } : undefined}
          >
            #{tag.label}
          </button>
          <span className='ms-auto inline-flex shrink-0 items-center gap-0.5'>
            {tag.qid && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type='button'
                    aria-label={t`Boost interest`}
                    className='text-muted-foreground hover:bg-hover hover:text-foreground rounded p-0.5 transition-colors'
                    onClick={(e) => {
                      e.preventDefault()
                      e.stopPropagation()
                      onInterestUp?.(tag.qid!)
                      setAdjustments((prev) => ({ ...prev, [tag.qid!]: Math.min(100, (prev[tag.qid!] ?? tag.interest ?? 0) + 15) }))
                    }}
                  >
                    <Plus className='size-3.5' />
                  </button>
                </TooltipTrigger>
                <TooltipContent>{t`Boost interest`}</TooltipContent>
              </Tooltip>
            )}
            {tag.qid && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type='button'
                    aria-label={t`Reduce interest`}
                    className='text-muted-foreground hover:bg-hover hover:text-foreground rounded p-0.5 transition-colors'
                    onClick={(e) => {
                      e.preventDefault()
                      e.stopPropagation()
                      onInterestDown?.(tag.qid!)
                      setAdjustments((prev) => ({ ...prev, [tag.qid!]: Math.max(-100, (prev[tag.qid!] ?? tag.interest ?? 0) - 20) }))
                    }}
                  >
                    <Minus className='size-3.5' />
                  </button>
                </TooltipTrigger>
                <TooltipContent>{t`Reduce interest`}</TooltipContent>
              </Tooltip>
            )}
            {tag.qid && onInterestRemove && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type='button'
                    aria-label={t`Remove interest`}
                    className='text-muted-foreground hover:bg-hover rounded p-0.5 transition-colors'
                    onClick={(e) => {
                      e.preventDefault()
                      e.stopPropagation()
                      onInterestRemove(tag.qid!)
                      setAdjustments((prev) => ({ ...prev, [tag.qid!]: null }))
                    }}
                  >
                    <X className='size-3.5' />
                  </button>
                </TooltipTrigger>
                <TooltipContent>{t`Remove interest`}</TooltipContent>
              </Tooltip>
            )}
          </span>
        </div>
        )
      })}
    </div>
  )
}
