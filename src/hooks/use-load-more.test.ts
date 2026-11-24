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
    const fetcher = vi.fn(
      async ({ page }: { page: number; limit: number }) => ({
        items: rows(page * 20 - 19, 20),
        total: 45,
      })
    )

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
    const fetcher = vi.fn(
      async ({ page }: { page: number; limit: number }) => ({
        items: rows(page * 20 - 19, 20),
        total: 60,
      })
    )

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

  it('pages by number, sending no cursor, when the answers carry none', async () => {
    const fetcher = vi.fn(
      async (_args: { page: number; limit: number; after?: string }) => ({
        items: rows(21, 20),
        total: 45,
      })
    )
    const loaderItems = rows(1, 20)
    const { result } = renderHook(() =>
      useLoadMore<Row>({ fetcher, initial: { items: loaderItems, total: 45 } })
    )
    await act(async () => {
      await result.current.loadMore()
    })
    expect(fetcher.mock.calls[0][0]).not.toHaveProperty('after')
    expect(result.current.hasMore).toBe(true)
  })
})

interface Versioned {
  id: string
  version: string
}

describe('useLoadMore merging', () => {
  it('keeps the row it already holds when a page repeats it', async () => {
    // A row added ahead of the first page pushes its last row onto the second.
    const first: Versioned[] = [
      { id: 'a', version: 'first' },
      { id: 'b', version: 'first' },
    ]
    const fetcher = vi.fn(async () => ({
      items: [
        { id: 'b', version: 'second' },
        { id: 'c', version: 'second' },
      ],
      total: 4,
    }))
    const { result } = renderHook(() =>
      useLoadMore<Versioned>({ fetcher, initial: { items: first, total: 4 } })
    )
    await act(async () => {
      await result.current.loadMore()
    })
    expect(result.current.items.map((row) => row.id)).toEqual(['a', 'b', 'c'])
    expect(result.current.items[1].version).toBe('first')
  })
})

describe('useLoadMore cursors', () => {
  it('asks for each page after the cursor the last answer carried', async () => {
    const fetcher = vi.fn(
      async ({ after }: { page: number; limit: number; after?: string }) =>
        after === 'c1'
          ? { items: rows(21, 20), total: 60, next: 'c2' }
          : { items: rows(41, 20), total: 60, next: '' }
    )
    const loaderItems = rows(1, 20)
    const { result, rerender } = renderHook(() =>
      useLoadMore<Row>({
        fetcher,
        initial: { items: loaderItems, total: 60, next: 'c1' },
      })
    )
    await act(async () => {
      await result.current.loadMore()
    })
    rerender()
    await act(async () => {
      await result.current.loadMore()
    })
    rerender()
    expect(fetcher.mock.calls.map(([p]) => p.after)).toEqual(['c1', 'c2'])
    expect(result.current.items).toHaveLength(60)
    expect(result.current.hasMore).toBe(false)
  })

  it('ends the list when the answer says nothing follows, whatever the total', async () => {
    const fetcher = vi.fn(async () => ({ items: rows(21, 20), total: 100 }))
    const loaderItems = rows(1, 20)
    const { result } = renderHook(() =>
      useLoadMore<Row>({
        fetcher,
        initial: { items: loaderItems, total: 100, next: '' },
      })
    )
    expect(result.current.hasMore).toBe(false)
    await act(async () => {
      await result.current.loadMore()
    })
    expect(fetcher).not.toHaveBeenCalled()
  })

  it('ends the list when a page on a cursor adds no row', async () => {
    // A server that answers the same rows on every cursor must not hold the
    // list in a loop.
    const fetcher = vi.fn(async () => ({
      items: rows(1, 20),
      total: 100,
      next: 'again',
    }))
    const loaderItems = rows(1, 20)
    const { result } = renderHook(() =>
      useLoadMore<Row>({
        fetcher,
        initial: { items: loaderItems, total: 100, next: 'c1' },
      })
    )
    await act(async () => {
      await result.current.loadMore()
    })
    expect(result.current.hasMore).toBe(false)
  })

  it('drops a page that arrives after the filter changed', async () => {
    let release: (value: {
      items: Row[]
      total: number
      next: string
    }) => void = () => {}
    const stale = new Promise<{ items: Row[]; total: number; next: string }>(
      (resolve) => {
        release = resolve
      }
    )
    const fetcher = vi.fn(
      async ({ status }: { status: string; page: number; limit: number }) =>
        status === 'old' ? stale : { items: rows(500, 3), total: 3, next: '' }
    )
    const loaderItems = rows(1, 20)
    const { result, rerender } = renderHook(
      ({ status }: { status: string }) =>
        useLoadMore<Row, { status: string }>({
          fetcher,
          initial: { items: loaderItems, total: 60, next: 'c1' },
          params: { status },
        }),
      { initialProps: { status: 'old' } }
    )
    let pending: Promise<void> = Promise.resolve()
    act(() => {
      pending = result.current.loadMore()
    })
    rerender({ status: 'new' })
    await waitFor(() =>
      expect(result.current.items.map((row) => row.id)).toEqual([500, 501, 502])
    )
    await act(async () => {
      release({ items: rows(21, 20), total: 60, next: 'c2' })
      await pending
    })
    expect(result.current.items.map((row) => row.id)).toEqual([500, 501, 502])
    expect(result.current.hasMore).toBe(false)
  })
})

describe('useLoadMore filters', () => {
  // A route keyed on its filter: the filter and the loader's page for it
  // arrive in the same render.
  function routed() {
    const fetcher = vi.fn(
      async (_args: { status: string; page: number; limit: number }) => ({
        items: rows(900, 1),
        total: 1,
        next: '',
      })
    )
    const hook = renderHook(
      ({ status, items }: { status: string; items: Row[] }) =>
        useLoadMore<Row, { status: string }>({
          fetcher,
          initial: { items, total: items.length, next: '' },
          params: { status },
        }),
      { initialProps: { status: 'open', items: rows(1, 3) } }
    )
    return { fetcher, ...hook }
  }

  it("takes a filter's first page from the loader that answered it", async () => {
    const { fetcher, result, rerender } = routed()
    const resolved = rows(200, 2)
    rerender({ status: 'resolved', items: resolved })
    await waitFor(() => expect(result.current.items).toEqual(resolved))
    expect(fetcher).not.toHaveBeenCalled()
  })

  it('asks for a filter the loader did not answer', async () => {
    const { fetcher, result, rerender } = routed()
    const held = result.current.items
    rerender({ status: 'resolved', items: held })
    await waitFor(() =>
      expect(result.current.items.map((row) => row.id)).toEqual([900])
    )
    expect(fetcher).toHaveBeenCalledTimes(1)
    expect(fetcher.mock.calls[0][0]).toMatchObject({
      status: 'resolved',
      page: 1,
    })
  })

  it('asks for a filter it returns to after the loader re-read the page', async () => {
    const { fetcher, result, rerender } = routed()
    // The loader re-reads the same filter (an invalidation), then the filter
    // changes twice with no new page from it.
    const reread = rows(200, 2)
    rerender({ status: 'open', items: reread })
    rerender({ status: 'resolved', items: reread })
    await waitFor(() => expect(fetcher).toHaveBeenCalledTimes(1))
    rerender({ status: 'open', items: reread })
    await waitFor(() => expect(fetcher).toHaveBeenCalledTimes(2))
    expect(fetcher.mock.calls[1][0]).toMatchObject({ status: 'open' })
    await waitFor(() =>
      expect(result.current.items.map((row) => row.id)).toEqual([900])
    )
  })
})
