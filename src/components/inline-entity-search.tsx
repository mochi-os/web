// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: Apache-2.0

// Inline directory search: the compact search-and-subscribe panel an app shows
// on its empty state, as opposed to the full-page FindEntityPage beside it.
//
// crm, projects, feeds, forums, wikis and repos each grew a private copy. They
// render the same panel and differ only in icon, noun, the api module they call
// and where they navigate afterwards, so everything app-specific here is a
// prop: `search`, `probe` and `onSubscribe` are the app's own calls, and the
// item type flows through the generic so `onSubscribe` still receives the app's
// own row with whatever extra fields it carries.
//
// Only crm and projects guarded against out-of-order search responses. That
// guard is kept here, so the other four get it by adopting the component.

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { t } from '@lingui/core/macro'
import { Loader2, Search, type LucideIcon } from 'lucide-react'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { GeneralError } from '../features/errors/general-error'
import { cn } from '../lib/utils'

export interface InlineEntitySearchItem {
  id: string
  name: string
  fingerprint?: string
  /** Line under the name. Defaults to the fingerprint in three-character groups. */
  subtitle?: string
  /** Set by directories that already know the reader is subscribed. */
  subscribed?: boolean
}

export interface InlineEntitySearchProps<T extends InlineEntitySearchItem> {
  /** Ids and fingerprints already subscribed; matching rows are hidden. */
  subscribedIds: Set<string>
  /** Directory search for a plain query. */
  search: (query: string) => Promise<T[]>
  /**
   * Resolve a pasted link (mochi://<peer>/<id> or a web URL). A directory
   * search can't find a private or unlisted entity, and can't match a URL.
   * A link that resolves to nothing shows the empty message, not an error:
   * the server's refusal for a private entity is a raw label key.
   */
  probe?: (url: string) => Promise<T[]>
  /** Subscribe and go wherever the app goes next. Owns its own toasts. */
  onSubscribe: (item: T) => Promise<void> | void
  icon: LucideIcon
  /** Tailwind classes for the icon tile, e.g. 'bg-emerald-500/10 text-emerald-600'. */
  iconClassName?: string
  placeholder?: string
  emptyMessage?: ReactNode
  /** Fallback message when the search itself fails. */
  searchErrorMessage: string
  subscribeLabel?: ReactNode
  className?: string
}

const LINK_QUERY = /^(mochi:|https?:\/\/)/i

function hyphenate(fingerprint: string): string {
  return fingerprint.match(/.{1,3}/g)?.join('-') ?? fingerprint
}

export function InlineEntitySearch<T extends InlineEntitySearchItem>({
  subscribedIds,
  search,
  probe,
  onSubscribe,
  icon: Icon,
  iconClassName = 'bg-primary/10 text-primary',
  placeholder = t`Search...`,
  emptyMessage = t`No results found`,
  searchErrorMessage,
  subscribeLabel = t`Subscribe`,
  className,
}: InlineEntitySearchProps<T>) {
  const [searchQuery, setSearchQuery] = useState('')
  const [debouncedQuery, setDebouncedQuery] = useState('')
  const [results, setResults] = useState<T[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [searchError, setSearchError] = useState<Error | null>(null)
  const [pendingId, setPendingId] = useState<string | null>(null)

  // Typing fast leaves several searches in flight. Without this, a slow earlier
  // response can land after a fast later one and overwrite the list with
  // results for a query the reader has already moved past.
  const requestSeqRef = useRef(0)

  const searchRef = useRef(search)
  searchRef.current = search
  const probeRef = useRef(probe)
  probeRef.current = probe
  const errorMessageRef = useRef(searchErrorMessage)
  errorMessageRef.current = searchErrorMessage

  const runSearch = useCallback(async (query: string) => {
    if (query.length === 0) {
      setResults([])
      setSearchError(null)
      return
    }

    const requestSeq = ++requestSeqRef.current
    setIsLoading(true)
    setSearchError(null)
    try {
      if (LINK_QUERY.test(query) && probeRef.current) {
        const probed = await probeRef.current(query).catch(() => [])
        if (requestSeq !== requestSeqRef.current) return
        setResults(probed)
        return
      }
      const found = await searchRef.current(query)
      if (requestSeq !== requestSeqRef.current) return
      setResults(found)
    } catch (error) {
      if (requestSeq !== requestSeqRef.current) return
      setResults([])
      setSearchError(
        error instanceof Error ? error : new Error(errorMessageRef.current)
      )
    } finally {
      if (requestSeq === requestSeqRef.current) {
        setIsLoading(false)
      }
    }
  }, [])

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(searchQuery), 500)
    return () => clearTimeout(timer)
  }, [searchQuery])

  useEffect(() => {
    if (debouncedQuery.length === 0) {
      setResults([])
      setSearchError(null)
      return
    }
    void runSearch(debouncedQuery)
  }, [debouncedQuery, runSearch])

  const retrySearch = useCallback(() => {
    void runSearch(debouncedQuery)
  }, [debouncedQuery, runSearch])

  const handleSubscribe = async (item: T) => {
    setPendingId(item.id)
    try {
      await onSubscribe(item)
    } catch {
      // onSubscribe owns its own toast; swallowing here keeps a rejected
      // subscribe from surfacing as an unhandled rejection off the click.
    } finally {
      setPendingId(null)
    }
  }

  const showResults = debouncedQuery.length > 0
  const showLoading = isLoading && showResults
  const visible = results.filter(
    (item) =>
      !item.subscribed &&
      !subscribedIds.has(item.id) &&
      !(item.fingerprint && subscribedIds.has(item.fingerprint))
  )

  return (
    <div className={cn('mx-auto w-full max-w-md', className)}>
      <div className='relative mb-4'>
        <Search className='text-muted-foreground pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2' />
        <Input
          placeholder={placeholder}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className='h-10 ps-9'
          autoFocus
        />
      </div>

      {showLoading && (
        <div className='flex items-center justify-center py-8'>
          <Loader2 className='text-muted-foreground h-6 w-6 animate-spin' />
        </div>
      )}

      {!isLoading && showResults && searchError && (
        <GeneralError
          error={searchError}
          minimal
          mode='inline'
          reset={retrySearch}
        />
      )}

      {!isLoading && showResults && !searchError && visible.length === 0 && (
        <p className='text-muted-foreground py-4 text-center text-sm'>
          {emptyMessage}
        </p>
      )}

      {!isLoading && showResults && !searchError && visible.length > 0 && (
        <div className='divide-border divide-y rounded-lg border'>
          {visible.map((item) => {
            const isPending = pendingId === item.id
            const subtitle =
              item.subtitle ??
              (item.fingerprint ? hyphenate(item.fingerprint) : '')

            return (
              <div
                key={item.id}
                className='hover:bg-hover flex items-center justify-between gap-3 px-4 py-3 transition-colors'
              >
                <div className='flex min-w-0 flex-1 items-center gap-3'>
                  <div
                    className={cn(
                      'flex h-8 w-8 shrink-0 items-center justify-center rounded-md',
                      iconClassName
                    )}
                  >
                    <Icon className='h-4 w-4' />
                  </div>
                  <div className='flex min-w-0 flex-1 flex-col text-start'>
                    <span className='truncate text-sm font-medium'>
                      {item.name}
                    </span>
                    {subtitle && (
                      <span className='text-muted-foreground truncate text-xs'>
                        {subtitle}
                      </span>
                    )}
                  </div>
                </div>
                <Button
                  size='sm'
                  onClick={() => handleSubscribe(item)}
                  disabled={isPending}
                >
                  {isPending ? (
                    <Loader2 className='h-4 w-4 animate-spin' />
                  ) : (
                    subscribeLabel
                  )}
                </Button>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
