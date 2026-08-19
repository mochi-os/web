// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: Apache-2.0

// Every page that uses this hook builds its `initial` wrapper inline, so the
// wrapper is a fresh object on every render. Keying the loader-sync effect on
// that object reset the list after each append — "Load more" issued page 2
// forever and the list stayed at the first page (mochi-dev-490).

import { act, renderHook, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { useLoadMore } from './use-load-more'

interface Row {
  id: number
}

function rows(from: number, count: number): Row[] {
  return Array.from({ length: count }, (_, i) => ({ id: from + i }))
}

describe('useLoadMore', () => {
  it('keeps appended pages when the caller rebuilds initial on every render', async () => {
    const loaderItems = rows(1, 20)
    const fetcher = vi.fn(async ({ page }: { page: number; limit: number }) => ({
      items: rows(page * 20 - 19, 20),
      total: 45,
    }))

    const { result, rerender } = renderHook(() =>
      // Exactly how the pages write it: a new wrapper object each render,
      // around the same loader-provided items array.
      useLoadMore<Row>({ fetcher, initial: { items: loaderItems, total: 45 } })
    )

    expect(result.current.items).toHaveLength(20)

    await act(async () => {
      await result.current.loadMore()
    })
    rerender()

    await waitFor(() => expect(result.current.items).toHaveLength(40))
    expect(fetcher).toHaveBeenCalledWith(expect.objectContaining({ page: 2 }))
    expect(result.current.hasMore).toBe(true)
  })

  it('asks for the next page each time rather than repeating page 2', async () => {
    const loaderItems = rows(1, 20)
    const fetcher = vi.fn(async ({ page }: { page: number; limit: number }) => ({
      items: rows(page * 20 - 19, 20),
      total: 60,
    }))

    const { result, rerender } = renderHook(() =>
      useLoadMore<Row>({ fetcher, initial: { items: loaderItems, total: 60 } })
    )

    await act(async () => {
      await result.current.loadMore()
    })
    rerender()
    await act(async () => {
      await result.current.loadMore()
    })
    rerender()

    await waitFor(() => expect(result.current.items).toHaveLength(60))
    expect(fetcher.mock.calls.map(([p]) => p.page)).toEqual([2, 3])
    expect(result.current.hasMore).toBe(false)
  })

  it('still resets when the loader genuinely delivers new data', async () => {
    const fetcher = vi.fn(
      // Declared even though this fetcher ignores it: without the parameter,
      // vi.fn types mock.calls as an empty tuple and the page assertion at the
      // foot of this test cannot index it.
      async (_args: { page: number; limit: number }) => ({
        items: rows(21, 20),
        total: 45,
      })
    )
    const first = rows(1, 20)
    const second = rows(100, 5)

    const { result, rerender } = renderHook(
      ({ items, total }: { items: Row[]; total: number }) =>
        useLoadMore<Row>({ fetcher, initial: { items, total } }),
      { initialProps: { items: first, total: 45 } }
    )

    await act(async () => {
      await result.current.loadMore()
    })
    await waitFor(() => expect(result.current.items).toHaveLength(40))

    // A route loader re-run hands over a different array.
    rerender({ items: second, total: 5 })
    await waitFor(() => expect(result.current.items).toEqual(second))
    expect(result.current.total).toBe(5)

    // And the page counter restarted, so the next fetch asks for page 2.
    await act(async () => {
      await result.current.loadMore()
    })
    expect(fetcher.mock.calls.at(-1)?.[0].page).toBe(2)
  })
})
