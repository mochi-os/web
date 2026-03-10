import { useState, useRef, useEffect } from 'react'
import { Plus } from 'lucide-react'
import { getErrorMessage } from '../lib/handle-server-error'
import { toast } from '../lib/toast-utils'

type Tag = {
  id: string
  label: string
}

type TagSuggestion = {
  label: string
  count: number
}

interface TagInputProps {
  existingLabels: string[]
  onAdded: (tag: Tag) => void
  loadSuggestions: () => Promise<TagSuggestion[]>
  submitTag: (label: string) => Promise<Tag>
  invalidMessage?: string
  submitErrorMessage?: string
  placeholder?: string
}

const TAG_PATTERN = /^[a-z0-9 /-]+$/

export function TagInput({
  existingLabels,
  onAdded,
  loadSuggestions,
  submitTag,
  invalidMessage = 'Invalid tag: letters, numbers, spaces, hyphens, and slashes only (max 50 chars)',
  submitErrorMessage = 'Failed to add tag',
  placeholder = 'Add tag...',
}: TagInputProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [value, setValue] = useState('')
  const [suggestions, setSuggestions] = useState<TagSuggestion[]>([])
  const [showSuggestions, setShowSuggestions] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!isOpen) return
    loadSuggestions()
      .then(setSuggestions)
      .catch(() => {})
    inputRef.current?.focus()
  }, [isOpen, loadSuggestions])

  const filtered = suggestions.filter(
    (suggestion) =>
      suggestion.label.includes(value.toLowerCase().trim()) &&
      !existingLabels.includes(suggestion.label)
  )

  const submit = async (rawLabel: string) => {
    const cleaned = rawLabel.trim().toLowerCase()
    if (!cleaned || cleaned.length > 50 || !TAG_PATTERN.test(cleaned)) {
      toast.error(invalidMessage)
      return
    }
    if (existingLabels.includes(cleaned)) {
      setValue('')
      setShowSuggestions(false)
      return
    }
    try {
      const tag = await submitTag(cleaned)
      onAdded(tag)
      setValue('')
      setShowSuggestions(false)
    } catch (error) {
      toast.error(getErrorMessage(error, submitErrorMessage))
    }
  }

  if (!isOpen) {
    return (
      <button
        type='button'
        className='text-muted-foreground hover:text-foreground inline-flex items-center gap-1 rounded-full border border-dashed px-2 py-0.5 text-xs transition-colors'
        onClick={(event) => {
          event.preventDefault()
          event.stopPropagation()
          setIsOpen(true)
        }}
      >
        <Plus className='size-3' />
        Tag
      </button>
    )
  }

  return (
    <div
      className='relative inline-block'
      onClick={(event) => event.stopPropagation()}
    >
      <input
        ref={inputRef}
        type='text'
        value={value}
        onChange={(event) => {
          setValue(event.target.value)
          setShowSuggestions(true)
        }}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            event.preventDefault()
            void submit(value)
          }
          if (event.key === 'Escape') {
            setIsOpen(false)
            setValue('')
          }
        }}
        onBlur={() => {
          setTimeout(() => {
            setIsOpen(false)
            setValue('')
          }, 200)
        }}
        className='h-6 w-32 rounded-full border px-2.5 text-xs outline-none'
        placeholder={placeholder}
      />
      {showSuggestions && filtered.length > 0 && (
        <div className='bg-popover absolute top-full left-0 z-10 mt-1 w-48 rounded-[10px] border py-1 shadow-md'>
          {filtered.slice(0, 8).map((suggestion) => (
            <button
              key={suggestion.label}
              type='button'
              className='hover:bg-muted flex w-full items-center justify-between px-3 py-1.5 text-xs'
              onMouseDown={(event) => {
                event.preventDefault()
                void submit(suggestion.label)
              }}
            >
              <span>{suggestion.label}</span>
              <span className='text-muted-foreground'>{suggestion.count}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
