import { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { Minus, Plus, Tag as TagIcon, X } from 'lucide-react'
import { Popover, PopoverTrigger, PopoverContent } from './ui/popover'

export interface PostTag {
  id: string
  label: string
  qid?: string
  relevance?: number
  interest?: number
}

function interestHue(weight: number): number {
  // Continuous: red(-100) → blue(0) → green(+100)
  return 240 - (weight / 100) * 120
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
      setError('Tag must be 50 characters or less')
      return
    }
    if (!TAG_PATTERN.test(cleaned)) {
      setError('Letters, numbers, spaces, and hyphens only')
      return
    }
    if (tags.some((t) => t.label === cleaned)) {
      setError('Tag already exists')
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
      <PopoverTrigger asChild>
        <button
          type='button'
          className='text-muted-foreground hover:text-foreground -m-1 inline-flex items-center gap-1 p-1 transition-colors'
          onClick={(e) => {
            e.stopPropagation()
          }}
        >
          <TagIcon className='size-4' />
          {tags.length > 0 && <span>{tags.length}</span>}
        </button>
      </PopoverTrigger>
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
            placeholder='Add tag...'
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
            className='hover:underline truncate text-left'
            onClick={(e) => {
              e.preventDefault()
              e.stopPropagation()
              onFilter?.(tag.label)
            }}
            title={tag.relevance != null && interest != null ? `Relevance ${tag.relevance}, interest ${interest}` : tag.relevance != null ? `Relevance ${tag.relevance}` : interest != null ? `Interest ${interest}` : undefined}
            style={interest != null ? { color: `hsl(${interestHue(interest)}, 80%, 45%)` } : undefined}
          >
            #{tag.label}
          </button>
          <span className='ml-auto inline-flex shrink-0 items-center gap-0.5'>
            {tag.qid && (
              <button
                type='button'
                title='Boost interest'
                className='text-muted-foreground hover:bg-accent hover:text-foreground rounded p-0.5 transition-colors'
                onClick={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  onInterestUp?.(tag.qid!)
                  setAdjustments((prev) => ({ ...prev, [tag.qid!]: Math.min(100, (prev[tag.qid!] ?? tag.interest ?? 0) + 15) }))
                }}
              >
                <Plus className='size-3.5' />
              </button>
            )}
            {tag.qid && (
              <button
                type='button'
                title='Reduce interest'
                className='text-muted-foreground hover:bg-accent hover:text-foreground rounded p-0.5 transition-colors'
                onClick={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  onInterestDown?.(tag.qid!)
                  setAdjustments((prev) => ({ ...prev, [tag.qid!]: Math.max(-100, (prev[tag.qid!] ?? tag.interest ?? 0) - 20) }))
                }}
              >
                <Minus className='size-3.5' />
              </button>
            )}
            {tag.qid && onInterestRemove && (
              <button
                type='button'
                title='Remove interest'
                className='text-muted-foreground hover:bg-destructive/10 hover:text-destructive rounded p-0.5 transition-colors'
                onClick={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  onInterestRemove(tag.qid!)
                  setAdjustments((prev) => ({ ...prev, [tag.qid!]: null }))
                }}
              >
                <X className='size-3.5' />
              </button>
            )}
          </span>
        </div>
        )
      })}
    </div>
  )
}
