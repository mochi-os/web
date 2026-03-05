import { useState, useRef, useEffect } from 'react'
import { Minus, Plus, Tag as TagIcon, X } from 'lucide-react'
import { Popover, PopoverTrigger, PopoverContent } from './ui/popover'

export interface PostTag {
  id: string
  label: string
  qid?: string
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

const TAG_PATTERN = /^[a-z0-9 /\-]+$/

export function PostTagsTooltip({ tags, onRemove, onFilter, onAdd, onInterestUp, onInterestDown }: PostTagsTooltipProps) {
  const [open, setOpen] = useState(false)
  const [value, setValue] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (open && onAdd) {
      setTimeout(() => inputRef.current?.focus(), 0)
    }
    if (!open) {
      setValue('')
    }
  }, [open, onAdd])

  const submit = async () => {
    const cleaned = value.trim().toLowerCase()
    if (!cleaned || cleaned.length > 50 || !TAG_PATTERN.test(cleaned)) return
    if (tags.some((t) => t.label === cleaned)) {
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
        onPointerDownOutside={(e) => e.preventDefault()}
        onClick={(e) => e.stopPropagation()}
      >
        <PostTags tags={tags} onRemove={onRemove} onFilter={onFilter} onInterestUp={onInterestUp} onInterestDown={onInterestDown} />
        {onAdd && (
          <div className={tags.length > 0 ? 'mt-1.5 border-t pt-1.5' : ''}>
            <input
              ref={inputRef}
              type='text'
              value={value}
              onChange={(e) => setValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  submit()
                }
              }}
              className='text-foreground placeholder:text-muted-foreground h-6 w-full bg-transparent text-xs outline-none'
              placeholder='Add tag...'
            />
          </div>
        )}
      </PopoverContent>
    </Popover>
  )
}

export function PostTags({ tags, onRemove, onFilter, onInterestUp, onInterestDown }: PostTagsProps) {
  if (!tags.length) return null

  return (
    <div className='flex flex-col gap-0.5'>
      {tags.map((tag) => (
        <div
          key={tag.id}
          className='group/tag flex items-center gap-1 text-muted-foreground text-xs'
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
            #{tag.label}
          </button>
          <span className='ml-auto inline-flex shrink-0 items-center opacity-0 group-hover/tag:opacity-100 transition-opacity'>
            {onInterestUp && (
              <button
                type='button'
                className='text-muted-foreground/60 hover:text-foreground transition-colors'
                onClick={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  onInterestUp(tag.qid || tag.label, !tag.qid)
                }}
              >
                <Plus className='size-4' />
              </button>
            )}
            {onInterestDown && (
              <button
                type='button'
                className='text-muted-foreground/60 hover:text-foreground transition-colors'
                onClick={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  onInterestDown(tag.qid || tag.label, !tag.qid)
                }}
              >
                <Minus className='size-4' />
              </button>
            )}
            <button
              type='button'
              className='text-muted-foreground/60 hover:text-foreground transition-colors'
              onClick={(e) => {
                e.preventDefault()
                e.stopPropagation()
                onRemove?.(tag.id)
              }}
            >
              <X className='size-4' />
            </button>
          </span>
        </div>
      ))}
    </div>
  )
}
