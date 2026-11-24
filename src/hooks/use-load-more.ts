// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: Apache-2.0

import { t } from '@lingui/core/macro'
import {
  type Dispatch,
  type SetStateAction,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react'
import { getErrorMessage } from '../lib/handle-server-error'

export interface PaginatedResult<T> {
  items: T[]
  total: number
  /**
   * The cursor after the page's last row, sent back as `after` for the page
   * that follows; "" when nothing follows. An answer without it is paged by
   * `page` against `total`.
   */
  next?: string
}

export interface LoadMoreRequest {
  page: number
  limit: number
  /** The previous answer's `next`, when it carried one. */
  after?: string
}

export interface UseLoadMoreOptions<T, P = Record<string, unknown>> {
  fetcher: (params: P & LoadMoreRequest) => Promise<PaginatedResult<T>>
  initial?: PaginatedResult<T>
  params?: P
  limit?: number
  paramsKey?: string
  /** A row's identity, by default its `id`: a row already held is not added again. */
  id?: (row: T) => string | number | undefined
}

export interface UseLoadMoreResult<T> {
  items: T[]
  total: number
  hasMore: boolean
  isLoading: boolean
  error: string | null
  loadMore: () => Promise<void>
  reset: () => Promise<void>
  setItems: Dispatch<SetStateAction<T[]>>
  setTotal: Dispatch<SetStateAction<number>>
}

type RowId<T> = (row: T) => string | number | undefined

function rowKey<T>(row: T, id: RowId<T> | undefined): string | undefined {
  const key = id ? id(row) : (row as { id?: unknown } | null | undefined)?.id
  return typeof key === 'string' || typeof key === 'number'
    ? String(key)
    : undefined
}

// The held rows with a page's after them, leaving out any row already held, so
// a list keyed by id never holds one twice: the first occurrence stays.
function appendRows<T>(held: T[], rows: T[], id: RowId<T> | undefined): T[] {
  const seen = new Set<string>()
  for (const row of held) {
    const key = rowKey(row, id)
    if (key !== undefined) seen.add(key)
  }
  const fresh: T[] = []
  for (const row of rows) {
    const key = rowKey(row, id)
    if (key !== undefined) {
      if (seen.has(key)) continue
      seen.add(key)
    }
    fresh.push(row)
  }
  return fresh.length === 0 ? held : [...held, ...fresh]
}

// The cursor to ask the next page with. A page that adds no row, or answers
// the cursor it was asked with, ends the list, so a server that repeats itself
// cannot hold a list in a loop of requests.
function nextCursor(
  sent: string | undefined,
  answered: string | undefined,
  added: number
): string | undefined {
  if (answered === undefined) return undefined
  if (added === 0 || answered === sent) return ''
  return answered
}

export function useLoadMore<T, P = Record<string, unknown>>(
  options: UseLoadMoreOptions<T, P>
): UseLoadMoreResult<T> {
  const { fetcher, initial, params, limit = 20, id } = options
  const paramsKey = options.paramsKey ?? JSON.stringify(params ?? {})

  const [items, setItems] = useState<T[]>(initial?.items ?? [])
  const [total, setTotal] = useState<number>(initial?.total ?? 0)
  const [next, setNext] = useState<string | undefined>(initial?.next)
  const [page, setPage] = useState<number>(1)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const firstRun = useRef(true)
  const paramsKeyRef = useRef(paramsKey)
  const initialItemsRef = useRef(initial?.items)
  // The params a caller's first page arrived with, in the commit that adopted
  // it. A route keyed on its filter hands over the new filter's page in the
  // same render as the filter, so the params effect has nothing to ask; a
  // filter the loader does not read still changes with the page unchanged.
  const adopted = useRef<string | undefined>(undefined)
  // The newest first page: an answer to an older one is dropped, so a filter
  // changed while a page was on its way cannot leave the old filter's rows.
  const generation = useRef(0)
  const itemsRef = useRef(items)
  itemsRef.current = items
  const fetcherRef = useRef(fetcher)
  const paramsRef = useRef(params)
  const idRef = useRef(id)
  useEffect(() => {
    fetcherRef.current = fetcher
    paramsRef.current = params
    idRef.current = id
  })

  // Keyed on the items array, not the wrapper: callers build the wrapper
  // inline, so it is a new reference every render, and keying on it reset the
  // list to page 1 after every append. The items identity changes only when the
  // loader re-runs.
  const initialItems = initial?.items
  const initialTotal = initial?.total
  const initialNext = initial?.next
  useEffect(() => {
    if (initialItems && initialItems !== initialItemsRef.current) {
      initialItemsRef.current = initialItems
      adopted.current = paramsKey
      generation.current += 1
      itemsRef.current = initialItems
      setItems(initialItems)
      setTotal(initialTotal ?? 0)
      setNext(initialNext)
      setPage(1)
      setIsLoading(false)
    }
  }, [initialItems, initialTotal, initialNext, paramsKey])

  const fetchPage = useCallback(
    async (request: LoadMoreRequest, replace: boolean) => {
      if (replace) generation.current += 1
      const current = generation.current
      setIsLoading(true)
      setError(null)
      try {
        const result = await fetcherRef.current({
          ...(paramsRef.current ?? ({} as P)),
          ...request,
        })
        if (current !== generation.current) return
        const held = replace ? [] : itemsRef.current
        const merged = appendRows(held, result.items, idRef.current)
        itemsRef.current = merged
        setItems(merged)
        setTotal(result.total)
        setNext(
          replace
            ? result.next
            : nextCursor(
                request.after,
                result.next,
                merged.length - held.length
              )
        )
        setPage(request.page)
      } catch (err) {
        if (current !== generation.current) return
        setError(getErrorMessage(err, t`Failed to load`))
      } finally {
        if (current === generation.current) setIsLoading(false)
      }
    },
    []
  )

  // Refetch when params change, unless the caller's loader has just answered
  // them: asking again would send the same request twice and replace the
  // list twice.
  useEffect(() => {
    if (firstRun.current) {
      firstRun.current = false
      paramsKeyRef.current = paramsKey
      adopted.current = undefined
      return
    }
    if (paramsKeyRef.current === paramsKey) return
    paramsKeyRef.current = paramsKey
    const answered = adopted.current === paramsKey
    adopted.current = undefined
    if (answered) return
    void fetchPage({ page: 1, limit }, true)
  }, [paramsKey, limit, fetchPage])

  const hasMore = next === undefined ? items.length < total : next !== ''

  const loadMore = useCallback(async () => {
    if (isLoading || !hasMore) return
    await fetchPage(
      next ? { page: page + 1, limit, after: next } : { page: page + 1, limit },
      false
    )
  }, [fetchPage, hasMore, isLoading, limit, next, page])

  const reset = useCallback(
    () => fetchPage({ page: 1, limit }, true),
    [fetchPage, limit]
  )

  return {
    items,
    total,
    hasMore,
    isLoading,
    error,
    loadMore,
    reset,
    setItems,
    setTotal,
  }
}
