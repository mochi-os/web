// Mochi: Mention-textarea component for @mention autocomplete
// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: Apache-2.0

import { forwardRef, useEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { cn } from '../lib/utils'
import { computeMentionDropdownPosition } from './mention-dropdown-position'

/** Minimal user shape needed for mentions. */
export interface MentionUser {
  id: string
  name: string
}

interface MentionTextareaProps
  extends Omit<React.TextareaHTMLAttributes<HTMLTextAreaElement>, 'onChange'> {
  value: string
  onValueChange: (value: string) => void
  /** Static list of people to filter client-side (used by CRM/projects). */
  people?: MentionUser[]
  /** Async search function for people (used by feeds/forums). */
  onSearchPeople?: (query: string) => Promise<MentionUser[]>
  /** Optional callback fired when a mention is explicitly selected from the dropdown. */
  onMentionSelect?: (user: MentionUser) => void
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
  html.replace(/@\[([^\]]+)\]/g, (_, name: string) => {
    const safe = name.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
    return `<span class="text-primary font-medium">@${safe}</span>`
  })

// Match a mention query at the cursor, supporting Unicode letters, marks, numbers, underscore, and hyphen.
const mentionQueryPattern = /(^|[\s])@([\p{L}\p{M}\p{N}_-]*)$/u

function getMentionQuery(text: string, cursorPos: number): string | null {
  const match = text.slice(0, cursorPos).match(mentionQueryPattern)
  return match ? match[2] : null
}

export const MentionTextarea = forwardRef<HTMLTextAreaElement, MentionTextareaProps>(
  function MentionTextarea({
    value,
    onValueChange,
    people = [],
    onSearchPeople,
    onMentionSelect,
    className,
    onKeyDown,
    ...props
  }, forwardedRef) {
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const [mentionQuery, setMentionQuery] = useState<string | null>(null)
  const [asyncResults, setAsyncResults] = useState<MentionUser[]>([])
  const [activeIndex, setActiveIndex] = useState(0)
  const [dropdownPos, setDropdownPos] = useState<{
    top?: number
    bottom?: number
    left: number
    width: number
    maxHeight: number
  } | null>(null)

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

  // Reset active index when the filtered list changes
  useEffect(() => {
    setActiveIndex(0)
  }, [filtered.length])

  // Sync and clear mention query on programmatic value updates
  useEffect(() => {
    const textarea = textareaRef.current
    if (textarea) {
      const cursor = textarea.selectionStart ?? value.length
      setMentionQuery(getMentionQuery(value, cursor))
    }
  }, [value])

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
      const nextPos = computeMentionDropdownPosition({
        rect: {
          top: rect.top,
          bottom: rect.bottom,
          left: rect.left,
          width: rect.width,
        },
        viewportWidth: window.innerWidth,
        viewportHeight: window.innerHeight,
      })

      setDropdownPos((currentPos) =>
        currentPos &&
        currentPos.top === nextPos.top &&
        currentPos.bottom === nextPos.bottom &&
        currentPos.left === nextPos.left &&
        currentPos.width === nextPos.width &&
        currentPos.maxHeight === nextPos.maxHeight
          ? currentPos
          : {
              top: nextPos.top,
              bottom: nextPos.bottom,
              left: nextPos.left,
              width: nextPos.width,
              maxHeight: nextPos.maxHeight,
            },
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

    // Capture phase so nested scroll containers also reposition the portal.
    window.addEventListener('scroll', updateDropdownPosition, true)
    window.addEventListener('resize', updateDropdownPosition)

    return () => {
      resizeObserver?.disconnect()
      window.removeEventListener('scroll', updateDropdownPosition, true)
      window.removeEventListener('resize', updateDropdownPosition)
    }
  }, [isOpen, mentionQuery, value])

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    onValueChange(e.target.value)
    const cursor = e.target.selectionStart ?? e.target.value.length
    setMentionQuery(getMentionQuery(e.target.value, cursor))
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (isOpen) {
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setActiveIndex((i) => (i + 1) % filtered.length)
        return
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault()
        setActiveIndex((i) => (i - 1 + filtered.length) % filtered.length)
        return
      }
      if (e.key === 'Enter') {
        e.preventDefault()
        insertMention(filtered[activeIndex])
        return
      }
      if (e.key === 'Escape') {
        e.stopPropagation()
        setMentionQuery(null)
        return
      }
    }
    onKeyDown?.(e)
  }

  const insertMention = (person: MentionUser) => {
    const textarea = textareaRef.current
    if (!textarea) return
    const cursor = textarea.selectionStart ?? value.length
    const before = value
      .slice(0, cursor)
      .replace(mentionQueryPattern, `$1@[${person.name}] `)
    onValueChange(before + value.slice(cursor))
    onMentionSelect?.(person)
    setMentionQuery(null)
    setTimeout(() => {
      textarea.focus()
      textarea.setSelectionRange(before.length, before.length)
    }, 0)
  }

  return (
    <>
      <textarea
        ref={(node) => {
          textareaRef.current = node
          if (typeof forwardedRef === 'function') {
            forwardedRef(node)
          } else if (forwardedRef) {
            forwardedRef.current = node
          }
        }}
        value={value}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        aria-activedescendant={
          isOpen ? `mention-option-${filtered[activeIndex]?.id}` : undefined
        }
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
              bottom: dropdownPos.bottom,
              left: dropdownPos.left,
              width: dropdownPos.width,
              maxHeight: dropdownPos.maxHeight,
              overflowY: 'auto',
              zIndex: 9999,
            }}
            className='bg-popover rounded-md border shadow-md'
          >
            {filtered.map((person, i) => (
              <button
                key={person.id}
                id={`mention-option-${person.id}`}
                role='option'
                aria-selected={i === activeIndex}
                type='button'
                className={cn(
                  'text-foreground flex w-full items-center px-3 py-2 text-start text-sm outline-none transition-colors',
                  i === activeIndex
                    ? 'bg-selected'
                    : 'hover:bg-hover hover:text-hover-foreground',
                )}
                onMouseDown={(e) => {
                  e.preventDefault()
                  insertMention(person)
                }}
                onMouseEnter={() => setActiveIndex(i)}
              >
                {person.name}
              </button>
            ))}
          </div>,
          document.body,
        )}
    </>
  )
})
