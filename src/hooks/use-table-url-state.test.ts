// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: Apache-2.0

// The hook's contract is that the URL holds the table's state. Browser
// back/forward and any other external navigation therefore have to move the
// displayed filters, not just the page - which is what these pin down.

import { describe, it, expect, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useTableUrlState, type NavigateFn } from './use-table-url-state'

type Search = Record<string, unknown>

const COLUMN_FILTERS = [
  { columnId: 'status', searchKey: 'status', type: 'array' as const },
  { columnId: 'name', searchKey: 'name', type: 'string' as const },
]

function setup(search: Search, navigate: NavigateFn = vi.fn()) {
  return renderHook(
    ({ search }: { search: Search }) =>
      useTableUrlState({ search, navigate, columnFilters: COLUMN_FILTERS }),
    { initialProps: { search } }
  )
}

describe('useTableUrlState reading from the URL', () => {
  it('starts from the search params it is given', () => {
    const { result } = setup({ status: ['open'], name: 'ada', page: 3 })

    // Positive control: the hook really did read this search object, so a
    // later "did not update" assertion is about the update path and not about
    // the hook ignoring its input entirely.
    expect(result.current.columnFilters).toEqual([
      { id: 'status', value: ['open'] },
      { id: 'name', value: 'ada' },
    ])
    expect(result.current.globalFilter).toBe('')
    expect(result.current.pagination.pageIndex).toBe(2)
  })

  it('follows an external change to the column filters', () => {
    const { result, rerender } = setup({ status: ['open'] })
    expect(result.current.columnFilters).toEqual([{ id: 'status', value: ['open'] }])

    // What browser back/forward does: same hook, new search object.
    rerender({ search: { status: ['closed'] } })

    expect(result.current.columnFilters).toEqual([{ id: 'status', value: ['closed'] }])
  })

  it('follows an external change that clears the column filters', () => {
    const { result, rerender } = setup({ status: ['open'], name: 'ada' })
    rerender({ search: {} })
    expect(result.current.columnFilters).toEqual([])
  })

  it('follows an external change to the global filter', () => {
    const { result, rerender } = setup({ filter: 'first' })
    expect(result.current.globalFilter).toBe('first')

    rerender({ search: { filter: 'second' } })
    expect(result.current.globalFilter).toBe('second')

    rerender({ search: {} })
    expect(result.current.globalFilter).toBe('')
  })

  it('follows an external change to pagination', () => {
    const { result, rerender } = setup({ page: 2 })
    expect(result.current.pagination.pageIndex).toBe(1)
    rerender({ search: { page: 5 } })
    expect(result.current.pagination.pageIndex).toBe(4)
  })
})

describe('useTableUrlState writing to the URL', () => {
  function patchFrom(navigate: ReturnType<typeof vi.fn>, previous: Search = {}) {
    const arg = navigate.mock.calls.at(-1)![0]
    const search = arg.search as (prev: Search) => Search
    return search(previous)
  }

  it('pushes a column filter change into the search params', () => {
    const navigate = vi.fn()
    const { result } = setup({}, navigate)

    act(() => {
      result.current.onColumnFiltersChange([{ id: 'status', value: ['open'] }])
    })

    expect(navigate).toHaveBeenCalledTimes(1)
    expect(patchFrom(navigate)).toMatchObject({ status: ['open'], page: undefined })
  })

  it('clears a search param when its filter empties', () => {
    const navigate = vi.fn()
    const { result } = setup({ status: ['open'] }, navigate)

    act(() => {
      result.current.onColumnFiltersChange([])
    })

    expect(patchFrom(navigate, { status: ['open'] })).toMatchObject({ status: undefined })
  })

  it('pushes a global filter change and resets the page', () => {
    const navigate = vi.fn()
    const { result } = setup({ page: 4 }, navigate)

    act(() => {
      result.current.onGlobalFilterChange!('ada')
    })

    expect(patchFrom(navigate, { page: 4 })).toMatchObject({ filter: 'ada', page: undefined })
  })

  it('drops an all-whitespace global filter rather than storing it', () => {
    const navigate = vi.fn()
    const { result } = setup({}, navigate)

    act(() => {
      result.current.onGlobalFilterChange!('   ')
    })

    expect(patchFrom(navigate)).toMatchObject({ filter: undefined })
  })

  it('pushes pagination changes', () => {
    const navigate = vi.fn()
    const { result } = setup({}, navigate)

    act(() => {
      result.current.onPaginationChange({ pageIndex: 3, pageSize: 10 })
    })

    expect(patchFrom(navigate)).toMatchObject({ page: 4, pageSize: undefined })
  })
})
