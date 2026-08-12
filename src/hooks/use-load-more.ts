// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: Apache-2.0

import { t } from '@lingui/core/macro'
import { type Dispatch, type SetStateAction, useCallback, useEffect, useRef, useState } from 'react'

export interface PaginatedResult<T> {
  items: T[]
  total: number
}

export interface UseLoadMoreOptions<T, P = Record<string, unknown>> {
  fetcher: (params: P & { page: number; limit: number }) => Promise<PaginatedResult<T>>
  initial?: PaginatedResult<T>
  params?: P
  limit?: number
  paramsKey?: string
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

export function useLoadMore<T, P = Record<string, unknown>>(
  options: UseLoadMoreOptions<T, P>,
): UseLoadMoreResult<T> {
  const { fetcher, initial, params, limit = 20 } = options
  const paramsKey = options.paramsKey ?? JSON.stringify(params ?? {})

  const [items, setItems] = useState<T[]>(initial?.items ?? [])
  const [total, setTotal] = useState<number>(initial?.total ?? 0)
  const [page, setPage] = useState<number>(1)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const firstRun = useRef(true)
  const paramsKeyRef = useRef(paramsKey)
  const initialItemsRef = useRef(initial?.items)

  // Sync to fresh loader data (e.g. after a route loader re-run), keyed on the
  // items array rather than the wrapper object. Callers build the wrapper
  // inline — `initial: data ? { items: data.rows, total: data.total } : undefined`
  // reads naturally and every page here writes it that way — so the wrapper is
  // a new reference on every render. Keying on it re-ran this effect after each
  // append, resetting the list to the loader's first page and the page counter
  // to 1: "Load more" fetched page 2 forever and the list never grew. The items
  // array comes from loader data, so its identity changes only when the loader
  // actually re-runs, which is the event this is meant to follow.
  const initialItems = initial?.items
  const initialTotal = initial?.total
  useEffect(() => {
    if (initialItems && initialItems !== initialItemsRef.current) {
      initialItemsRef.current = initialItems
      setItems(initialItems)
      setTotal(initialTotal ?? 0)
      setPage(1)
    }
  }, [initialItems, initialTotal])

  const fetchPage = useCallback(
    async (nextPage: number, replace: boolean) => {
      setIsLoading(true)
      setError(null)
      try {
        const fetchParams = {
          ...(params ?? ({} as P)),
          page: nextPage,
          limit,
        } as P & { page: number; limit: number }
        const result = await fetcher(fetchParams)
        setItems((prev) => (replace ? result.items : [...prev, ...result.items]))
        setTotal(result.total)
        setPage(nextPage)
      } catch (err) {
        setError(err instanceof Error ? err.message : t`Failed to load`)
      } finally {
        setIsLoading(false)
      }
    },
    // fetcher intentionally excluded — callers typically pass inline functions
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [limit, paramsKey],
  )

  // Refetch when params change
  useEffect(() => {
    if (firstRun.current) {
      firstRun.current = false
      paramsKeyRef.current = paramsKey
      return
    }
    if (paramsKeyRef.current === paramsKey) return
    paramsKeyRef.current = paramsKey
    void fetchPage(1, true)
  }, [paramsKey, fetchPage])

  const loadMore = useCallback(async () => {
    if (isLoading) return
    if (items.length >= total) return
    await fetchPage(page + 1, false)
  }, [fetchPage, isLoading, items.length, page, total])

  const reset = useCallback(async () => {
    await fetchPage(1, true)
  }, [fetchPage])

  return {
    items,
    total,
    hasMore: items.length < total,
    isLoading,
    error,
    loadMore,
    reset,
    setItems,
    setTotal,
  }
}
