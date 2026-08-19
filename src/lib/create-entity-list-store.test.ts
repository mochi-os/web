// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: Apache-2.0

// crm and projects each grew the same 34-line sidebar list store and the same
// six-block suite over it. The store is one factory now, so the behaviour is
// asserted once here. What stays in the apps is their own wiring: the key their
// server answers under and their own failure wording.
//
// Ported from apps/crm/web/src/stores/crms-store.test.ts at main (6 blocks).
// `crms` becomes the factory's `rows`; everything else asserts as it did.
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
