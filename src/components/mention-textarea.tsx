// Mochi: Mention-textarea component for @mention autocomplete
// Copyright Alistair Cunningham 2026

import { useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { cn } from '../lib/utils'
import type { Person } from './person-picker'

export type { Person }

interface MentionTextareaProps
  extends Omit<React.TextareaHTMLAttributes<HTMLTextAreaElement>, 'onChange'> {
  value: string
  onValueChange: (value: string) => void
  /** Static list of people to filter client-side (used by CRM/projects). */
  people?: Person[]
  /** Async search function for people (used by feeds/forums). */
  onSearchPeople?: (query: string) => Promise<Person[]>
}

/** Convert @[name] tokens to styled React nodes. Use for plain-text comment bodies. */
export function renderMentions(content: string): ReactNode {
  return content.split(/(@\[[^\]]+\])/g).map((part, i) =>
    part.startsWith('@[') ? (
      <span key={i} className='text-primary font-medium'>
        @{part.slice(2, -1)}
      </span>
    ) : (
      part
    ),
  )
}

/** Convert @[name] tokens in sanitized HTML to styled spans. Run AFTER sanitizeHtml. */
export const highlightMentions = (html: string): string =>
  html.replace(/@\[([^\]]+)\]/g, '<span class="text-primary font-medium">@$1</span>')

function getMentionQuery(text: string, cursorPos: number): string | null {
  const match = text.slice(0, cursorPos).match(/@(\w*)$/)
  return match ? match[1] : null
}

export function MentionTextarea({
  value,
  onValueChange,
  people = [],
  onSearchPeople,
  className,
  onKeyDown,
  ...props
}: MentionTextareaProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const [mentionQuery, setMentionQuery] = useState<string | null>(null)
  const [asyncResults, setAsyncResults] = useState<Person[]>([])
  const [dropdownPos, setDropdownPos] = useState<{ top: number; left: number; width: number } | null>(null)

  // Debounced async search
  useEffect(() => {
    if (!onSearchPeople || mentionQuery === null) {
      setAsyncResults([])
      return
    }
    const timer = setTimeout(() => {
      onSearchPeople(mentionQuery)
        .then((results) => {
          setAsyncResults(Array.isArray(results) ? results : [])
        })
        .catch(() => setAsyncResults([]))
    }, 150)
    return () => clearTimeout(timer)
  }, [mentionQuery, onSearchPeople])

  const filtered =
    mentionQuery !== null
      ? onSearchPeople
        ? asyncResults.slice(0, 8)
        : people
            .filter((p) => p.name.toLowerCase().startsWith(mentionQuery.toLowerCase()))
            .slice(0, 8)
      : []
  const isOpen = mentionQuery !== null && filtered.length > 0

  useEffect(() => {
    if (!isOpen) {
      setDropdownPos(null)
      return
    }

    const updateDropdownPosition = () => {
      if (!textareaRef.current) {
        return
      }

      const rect = textareaRef.current.getBoundingClientRect()
      const nextPos = {
        top: rect.bottom + 4,
        left: rect.left,
        width: rect.width,
      }

      setDropdownPos((currentPos) =>
        currentPos &&
        currentPos.top === nextPos.top &&
        currentPos.left === nextPos.left &&
        currentPos.width === nextPos.width
          ? currentPos
          : nextPos,
      )
    }

    updateDropdownPosition()

    const resizeObserver =
      typeof ResizeObserver !== 'undefined' && textareaRef.current
        ? new ResizeObserver(() => {
            updateDropdownPosition()
          })
        : null

    if (textareaRef.current && resizeObserver) {
      resizeObserver.observe(textareaRef.current)
    }

    window.addEventListener('scroll', updateDropdownPosition, true)
    window.addEventListener('resize', updateDropdownPosition)

    return () => {
      resizeObserver?.disconnect()
      window.removeEventListener('scroll', updateDropdownPosition, true)
      window.removeEventListener('resize', updateDropdownPosition)
    }
  }, [isOpen])

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    onValueChange(e.target.value)
    const cursor = e.target.selectionStart ?? e.target.value.length
    setMentionQuery(getMentionQuery(e.target.value, cursor))
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Escape' && mentionQuery !== null) {
      e.stopPropagation()
      setMentionQuery(null)
      return
    }
    onKeyDown?.(e)
  }

  const insertMention = (person: Person) => {
    const textarea = textareaRef.current
    if (!textarea) return
    const cursor = textarea.selectionStart ?? value.length
    const before = value.slice(0, cursor).replace(/@\w*$/, `@[${person.name}] `)
    onValueChange(before + value.slice(cursor))
    setMentionQuery(null)
    setTimeout(() => {
      textarea.focus()
      textarea.setSelectionRange(before.length, before.length)
    }, 0)
  }

  return (
    <>
      <textarea
        ref={textareaRef}
        value={value}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        className={cn(
          'border-input bg-background min-h-16 w-full rounded-lg border px-3 py-2 text-sm',
          className,
        )}
        {...props}
      />
      {isOpen &&
        dropdownPos &&
        createPortal(
          <div
            role='listbox'
            style={{
              position: 'fixed',
              top: dropdownPos.top,
              left: dropdownPos.left,
              width: dropdownPos.width,
              zIndex: 9999,
            }}
            className='bg-popover max-h-72 overflow-y-auto rounded-md border shadow-md'
          >
            {filtered.map((person) => (
              <button
                key={person.id}
                role='option'
                type='button'
                className='hover:bg-accent hover:text-accent-foreground focus-visible:bg-accent focus-visible:text-accent-foreground flex w-full items-center px-3 py-2 text-left text-sm outline-none'
                onMouseDown={(e) => {
                  e.preventDefault()
                  insertMention(person)
                }}
              >
                {person.name}
              </button>
            ))}
          </div>,
          document.body,
        )}
    </>
  )
}
