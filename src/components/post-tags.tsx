import { useState, useRef, useEffect } from 'react'
import { Minus, Plus, Tag as TagIcon, X } from 'lucide-react'
import { Popover, PopoverTrigger, PopoverContent } from './ui/popover'

export interface PostTag {
  id: string
  label: string
  qid?: string
  relevance?: number
}

interface PostTagsTooltipProps {
  tags: PostTag[]
  onRemove?: (tagId: string) => void
  onFilter?: (label: string) => void
  onAdd?: (label: string) => Promise<void> | void
  onInterestUp?: (qidOrLabel: string, isLabel?: boolean) => void
  onInterestDown?: (qidOrLabel: string, isLabel?: boolean) => void
}

interface PostTagsProps {
  tags: PostTag[]
  onRemove?: (tagId: string) => void
  onFilter?: (label: string) => void
  onInterestUp?: (qidOrLabel: string, isLabel?: boolean) => void
  onInterestDown?: (qidOrLabel: string, isLabel?: boolean) => void
}

const TAG_PATTERN = /^[a-z0-9 /-]+$/

export function PostTagsTooltip({ tags, onRemove, onFilter, onAdd, onInterestUp, onInterestDown }: PostTagsTooltipProps) {
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
      <PopoverTrigger asChild>
        <button
          type='button'
          className='text-muted-foreground hover:text-foreground inline-flex items-center gap-1 transition-colors'
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
        onPointerDownOutside={(e) => { e.preventDefault(); setOpen(false) }}
        onClick={(e) => e.stopPropagation()}
      >
        <PostTags tags={tags} onRemove={onRemove} onFilter={onFilter} onInterestUp={onInterestUp} onInterestDown={onInterestDown} />
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

export function PostTags({ tags, onRemove, onFilter, onInterestUp, onInterestDown }: PostTagsProps) {
  if (!tags.length) return null

  return (
    <div className='flex flex-col gap-1'>
      {tags.map((tag) => (
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
          >
            <span title={tag.relevance ? `Relevance: ${tag.relevance}` : undefined}>#{tag.label}</span>
          </button>
          <span className='ml-auto inline-flex shrink-0 items-center gap-0.5'>
            <button
              type='button'
              title='Boost interest'
              className='text-muted-foreground hover:bg-accent hover:text-foreground rounded p-0.5 transition-colors'
              onClick={(e) => {
                e.preventDefault()
                e.stopPropagation()
                onInterestUp?.(tag.qid || tag.label, !tag.qid)
              }}
            >
              <Plus className='size-3.5' />
            </button>
            <button
              type='button'
              title='Reduce interest'
              className='text-muted-foreground hover:bg-accent hover:text-foreground rounded p-0.5 transition-colors'
              onClick={(e) => {
                e.preventDefault()
                e.stopPropagation()
                onInterestDown?.(tag.qid || tag.label, !tag.qid)
              }}
            >
              <Minus className='size-3.5' />
            </button>
            <button
              type='button'
              title='Remove tag'
              className='text-muted-foreground hover:bg-destructive/10 hover:text-destructive rounded p-0.5 transition-colors'
              onClick={(e) => {
                e.preventDefault()
                e.stopPropagation()
                onRemove?.(tag.id)
              }}
            >
              <X className='size-3.5' />
            </button>
          </span>
        </div>
      ))}
    </div>
  )
}
