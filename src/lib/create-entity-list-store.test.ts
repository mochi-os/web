// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: Apache-2.0

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createEntityListStore } from './create-entity-list-store'

interface Row {
  id: string
  name: string
}

const list = vi.fn()

const useStore = createEntityListStore<Row>({
  list,
  listKey: 'entities',
  errorMessage: () => 'Failed to load entities',
})

describe('createEntityListStore', () => {
  beforeEach(() => {
    useStore.setState({ rows: [], isLoading: false, error: null })
    vi.clearAllMocks()
  })

  it('should have correct initial state', () => {
    const state = useStore.getState()

    expect(state.rows).toEqual([])
    expect(state.isLoading).toBe(false)
    expect(state.error).toBeNull()
  })

  it('should set loading state when refreshing', async () => {
    list.mockResolvedValue({ data: { entities: [] } })

    const refreshPromise = useStore.getState().refresh()

    expect(useStore.getState().isLoading).toBe(true)

    await refreshPromise

    expect(useStore.getState().isLoading).toBe(false)
  })

  it('should load rows successfully', async () => {
    const rows: Row[] = [
      { id: '1', name: 'Entity 1' },
      { id: '2', name: 'Entity 2' },
    ]
    list.mockResolvedValue({ data: { entities: rows } })

    await useStore.getState().refresh()

    const state = useStore.getState()
    expect(state.rows).toEqual(rows)
    expect(state.isLoading).toBe(false)
    expect(state.error).toBeNull()
  })

  it('should handle API errors', async () => {
    list.mockRejectedValue(new Error('Network error'))

    await useStore.getState().refresh()

    const state = useStore.getState()
    expect(state.rows).toEqual([])
    expect(state.isLoading).toBe(false)
    expect(state.error).toBe('Network error')
  })

  it('should handle an empty list', async () => {
    list.mockResolvedValue({ data: { entities: [] } })

    await useStore.getState().refresh()

    const state = useStore.getState()
    expect(state.rows).toEqual([])
    expect(state.error).toBeNull()
  })

  it('should handle a missing rows array gracefully', async () => {
    list.mockResolvedValue({ data: { entities: undefined } })

    await useStore.getState().refresh()

    const state = useStore.getState()
    expect(state.rows).toEqual([])
    expect(state.error).toBeNull()
  })
})

// The route loader starts the first load beside the page's own requests, and
// the sidebar's mount must join it rather than send a second.
describe('createEntityListStore first load', () => {
  beforeEach(() => {
    useStore.setState({
      rows: [],
      isLoading: false,
      error: null,
      started: false,
    })
    vi.clearAllMocks()
  })

  function deferred() {
    let resolve!: (value: unknown) => void
    const promise = new Promise((r) => {
      resolve = r
    })
    return { promise, resolve }
  }

  it('joins a load already in flight', async () => {
    const answer = deferred()
    list.mockReturnValue(answer.promise)
    const first = useStore.getState().load()
    const second = useStore.getState().load()
    // The second settles with the first, once the list is in.
    let settled = false
    void second.then(() => {
      settled = true
    })
    await Promise.resolve()
    expect(settled).toBe(false)
    answer.resolve({ data: { entities: [{ id: '1', name: 'One' }] } })
    await second
    expect(useStore.getState().rows).toEqual([{ id: '1', name: 'One' }])
    await first
    expect(list).toHaveBeenCalledTimes(1)
  })

  it('still asks again for a refresh while a load is in flight', async () => {
    // A refresh follows a change, which the load in flight may predate.
    const answer = deferred()
    list.mockReturnValueOnce(answer.promise)
    list.mockResolvedValueOnce({ data: { entities: [] } })
    const first = useStore.getState().load()
    const again = useStore.getState().refresh()
    answer.resolve({ data: { entities: [] } })
    await Promise.all([first, again])
    expect(list).toHaveBeenCalledTimes(2)
  })

  it('does not ask again once the page has loaded it', async () => {
    // The sidebar mounts after the route's load has answered.
    list.mockResolvedValue({ data: { entities: [] } })
    await useStore.getState().load()
    await useStore.getState().load()
    expect(list).toHaveBeenCalledTimes(1)
  })

  it('still asks again on a refresh after the page has loaded it', async () => {
    list.mockResolvedValue({ data: { entities: [] } })
    await useStore.getState().load()
    await useStore.getState().refresh()
    expect(list).toHaveBeenCalledTimes(2)
  })

  it('says whether a load has been asked for', async () => {
    useStore.setState({ started: false })
    expect(useStore.getState().started).toBe(false)
    list.mockResolvedValue({ data: { entities: [] } })
    await useStore.getState().load()
    expect(useStore.getState().started).toBe(true)
  })
})
