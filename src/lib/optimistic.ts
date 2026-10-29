// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: Apache-2.0

// Optimistic updates for React Query caches: a toggle, vote or pick shows on
// the click and goes back if the server refuses it. The mutation keeps its own
// mutationFn, onSuccess and error toast; this adds the two steps around them.
//
//   const watch = optimistic(queryClient, (watching: boolean) => [
//     {
//       filters: { queryKey: ['object', id], exact: true },
//       update: (old: Detail) => ({ ...old, watching: !watching }),
//     },
//   ])
//   useMutation({
//     mutationFn,
//     onMutate: watch.onMutate,
//     onError: (error, _variables, context) => {
//       watch.rollback(context)
//       toast.error(...)
//     },
//     onSuccess, // its refetch swaps the guess for the server's answer
//   })
//
// Patch only queries the mutation already refetches on success, so the
// server's answer always replaces the guess. Nothing here sends a request: a
// refused call puts the snapshot back rather than refetching, so the mutation
// costs the server exactly what it did before.

import {
  hashKey,
  type QueryClient,
  type QueryFilters,
  type QueryKey,
} from '@tanstack/react-query'

export interface OptimisticPatch {
  /** The queries to change: one key with `exact`, or a prefix for several. */
  filters: QueryFilters
  /**
   * The data to show until the server answers, given what is cached now.
   * Called only for queries that hold data. `old` is typed `never` so a caller
   * can name its own type on the parameter.
   */
  update: (old: never) => unknown
}

interface Entry {
  call: OptimisticCall
  key: QueryKey
  /** What goes back if this call is refused. */
  snapshot: unknown
}

// One per patched query: the calls still waiting on the server, in click
// order, and the query's update count after this module last wrote to it.
interface Slot {
  entries: Entry[]
  count: number | undefined
}

class OptimisticCall {
  readonly entries: Entry[] = []
}

const registries = new WeakMap<QueryClient, Map<string, Slot>>()

function slotsFor(queryClient: QueryClient): Map<string, Slot> {
  let slots = registries.get(queryClient)
  if (!slots) {
    const created = new Map<string, Slot>()
    // A settled call leaves nothing to undo. Its callbacks belong to the
    // caller, so learn of it from the cache instead. A refusal arrives here
    // after onError, where rollback has already dropped it.
    queryClient.getMutationCache().subscribe((event) => {
      if (event.type !== 'updated') return
      if (event.action.type !== 'success' && event.action.type !== 'error')
        return
      const context = event.mutation.state.context
      if (context instanceof OptimisticCall) forget(created, context)
    })
    registries.set(queryClient, created)
    slots = created
  }
  return slots
}

function forget(slots: Map<string, Slot>, call: OptimisticCall) {
  for (const entry of call.entries) {
    const hash = hashKey(entry.key)
    const slot = slots.get(hash)
    if (!slot) continue
    slot.entries = slot.entries.filter((other) => other !== entry)
    if (slot.entries.length === 0) slots.delete(hash)
  }
}

export function optimistic<TVariables>(
  queryClient: QueryClient,
  patches: (variables: TVariables) => OptimisticPatch[]
) {
  const countOf = (key: QueryKey) =>
    queryClient.getQueryState(key)?.dataUpdateCount

  return {
    /** Pass as the mutation's `onMutate`, unwrapped. */
    onMutate: async (variables: TVariables): Promise<OptimisticCall> => {
      const list = patches(variables)
      // A fetch already on its way would land after the patch and put the old
      // value back on screen. Only a query holding data is patched, so only
      // that one is stopped: a first load cancelled here is never sent again,
      // and its screen would wait for it until the window is next focused.
      await Promise.all(
        list.map(({ filters }) =>
          queryClient.cancelQueries({
            ...filters,
            predicate: (query) =>
              query.state.data !== undefined &&
              (filters.predicate?.(query) ?? true),
          })
        )
      )

      // Every change is worked out before any is written, so an update that
      // throws leaves the cache untouched. Two patches on one query apply in
      // turn.
      const changes = new Map<
        string,
        { key: QueryKey; old: unknown; next: unknown }
      >()
      for (const { filters, update } of list) {
        for (const [key, data] of queryClient.getQueriesData(filters)) {
          const hash = hashKey(key)
          const change = changes.get(hash)
          const current = change ? change.next : data
          if (current === undefined) continue
          const next = update(current as never)
          if (change) change.next = next
          else changes.set(hash, { key, old: data, next })
        }
      }

      const call = new OptimisticCall()
      const slots = slotsFor(queryClient)
      for (const [hash, { key, old, next }] of changes) {
        if (next === undefined || next === old) continue
        queryClient.setQueryData(key, next)
        const entry = { call, key, snapshot: old }
        call.entries.push(entry)
        const slot = slots.get(hash) ?? { entries: [], count: undefined }
        slot.entries.push(entry)
        slot.count = countOf(key)
        slots.set(hash, slot)
      }
      return call
    },

    /** Put back what a refused call changed. Call it first in `onError`.
     * Takes the context as TanStack hands it over, which a hook that forwards
     * its caller's options types `unknown`; anything else is ignored. */
    rollback: (call: unknown) => {
      if (!(call instanceof OptimisticCall)) return
      const slots = slotsFor(queryClient)
      for (const entry of call.entries) {
        const slot = slots.get(hashKey(entry.key))
        const index = slot ? slot.entries.indexOf(entry) : -1
        if (!slot || index === -1) continue
        const later = slot.entries[index + 1]
        if (later) {
          // A later click is still waiting, and its value is the one on
          // screen. If that is refused too, it goes back to what was there
          // before this one.
          later.snapshot = entry.snapshot
        } else if (countOf(entry.key) === slot.count) {
          // Only over a guess: if a refetch has landed since, its data is
          // newer than the snapshot and stays.
          queryClient.setQueryData(entry.key, entry.snapshot)
          slot.count = countOf(entry.key)
        }
      }
      forget(slots, call)
    },
  }
}
