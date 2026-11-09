// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: Apache-2.0

// Undo for a change shown on the click, one item at a time. The `optimistic`
// helper puts back a whole cached query, which is right for one toggle on one
// thing, and wrong when the same query holds several things clicked at once:
// with a vote on two comments of one post, the second accepted and the first
// refused, the whole post would go back to before both. This puts back only
// the fields the refused click changed, on only its own item, so every other
// write to the query stays.
//
// Two layers:
// - `undoChain`: the click order for one thing, for state held anywhere (React
//   state, a store, a cache written by hand)
// - `optimisticFields`: the same order on React Query caches, used like
//   `optimistic`
//
// The click order, for two quick clicks on one thing:
// - refused with a later click still waiting: nothing changes on screen, and
//   the later click takes over what to put back if it is refused too
// - refused as the last click waiting: the value from before goes back
// - accepted: every earlier click on the thing has nothing left to undo, as
//   the server now holds this click's value

import {
  hashKey,
  replaceEqualDeep,
  type Query,
  type QueryClient,
  type QueryFilters,
  type QueryKey,
} from '@tanstack/react-query'

export interface UndoStep<T> {
  /** What showed before this click. Only the first call counts, so a state
   * updater that runs twice is safe. */
  remember: (value: T) => void
  /** The server took the change. */
  accepted: () => void
  /** The server refused it: what to put back, or null to change nothing. */
  refused: () => { value: T } | null
}

interface Waiting<T> {
  before?: { value: T }
}

/**
 * One chain per kind of change, made once at module level. Call it with the
 * thing's id on each click, and keep the step until the server answers.
 *
 *   const pins = undoChain<boolean>()
 *   const step = pins(post.id)
 *   step.remember(post.pinned)
 *   request.then(step.accepted, () => {
 *     const before = step.refused()
 *     if (before) setPinned(post.id, before.value)
 *   })
 */
export function undoChain<T>() {
  // The clicks still waiting on the server, per thing, oldest first.
  const waiting = new Map<string, Waiting<T>[]>()

  return (id: string): UndoStep<T> => {
    const entry: Waiting<T> = {}
    const list = waiting.get(id) ?? []
    list.push(entry)
    waiting.set(id, list)
    const tidy = () => {
      if (!list.length && waiting.get(id) === list) waiting.delete(id)
    }

    return {
      remember: (value) => {
        entry.before ??= { value }
      },
      accepted: () => {
        const index = list.indexOf(entry)
        if (index < 0) return
        list.splice(0, index + 1)
        tidy()
      },
      refused: () => {
        const index = list.indexOf(entry)
        if (index < 0) return null
        list.splice(index, 1)
        const later = list[index]
        tidy()
        if (later) {
          later.before = entry.before
          return null
        }
        return entry.before ?? null
      },
    }
  }
}

export interface FieldsPlace<TItem> {
  /** The queries that may hold the item: one key with `exact`, or a prefix. */
  filters: QueryFilters
  /**
   * Run `change` on the item with this id wherever it sits in `old`, and
   * return the new data. Return `old` itself when the item is not there or
   * `change` gave it back unchanged, so nothing is written. It is also run
   * once with a `change` that alters nothing, to find the queries holding
   * the item, so it must have no other effect. Called
   * only for queries that hold data. `old` is typed `never` so a caller can
   * name its own type on the parameter.
   */
  edit: (old: never, id: string, change: (item: TItem) => TItem) => unknown
}

export interface OptimisticFields<TVariables, TItem> {
  /** Where the item is cached. Several places can hold copies of it. */
  places: FieldsPlace<TItem>[]
  /** The item a click changes. */
  id: (variables: TVariables) => string
  /** The fields a click changes. Only these go back on a refusal. */
  fields: readonly (keyof TItem)[]
  /** The item as it shows until the server answers. Return `item` itself to
   * change nothing. */
  apply: (item: TItem, variables: TVariables) => TItem
}

type Fields = Record<PropertyKey, unknown>

interface Step {
  key: QueryKey
  /** The place's `edit` for this item, to put its fields back. */
  edit: (old: unknown, change: (item: Fields) => Fields) => unknown
  undo: UndoStep<Fields>
  /** What this click showed, to tell whether anything wrote over it since. */
  after: Fields
}

class FieldsCall {
  readonly steps: Step[] = []
  /** Every query the click stopped fetching, whether or not it held the
   * item, by hash. */
  readonly queries = new Map<string, QueryKey>()
}

interface Registry {
  chain: (id: string) => UndoStep<Fields>
  /** Calls still waiting, per query. */
  waiting: Map<string, Set<FieldsCall>>
  /** Queries a click stopped a fetch for, refetched once nothing waits. */
  stopped: Set<string>
}

const registries = new WeakMap<QueryClient, Registry>()

function registryFor(queryClient: QueryClient): Registry {
  const registry = registries.get(queryClient)
  if (registry) return registry
  const created: Registry = {
    chain: undoChain<Fields>(),
    waiting: new Map(),
    stopped: new Set(),
  }
  // Learn of a settled call from the cache, as `optimistic` does, so the
  // caller's onSuccess stays its own. A refusal reaches here after onError,
  // where `rollback` has put its fields back; if the caller left `rollback`
  // out, the call still stops waiting, and nothing goes back.
  queryClient.getMutationCache().subscribe((event) => {
    if (event.type !== 'updated') return
    const context = event.mutation.state.context
    if (!(context instanceof FieldsCall)) return
    if (event.action.type === 'success') {
      for (const step of context.steps) step.undo.accepted()
      settle(queryClient, created, context)
    } else if (event.action.type === 'error') {
      settle(queryClient, created, context)
    }
  })
  registries.set(queryClient, created)
  return created
}

// A call is done with its queries. A fetch it stopped on the click is sent
// once no other click waits on that query, so it cannot land over a guess.
function settle(
  queryClient: QueryClient,
  registry: Registry,
  call: FieldsCall
) {
  for (const [hash, key] of call.queries) {
    const calls = registry.waiting.get(hash)
    if (!calls?.delete(call)) continue
    if (calls.size) continue
    registry.waiting.delete(hash)
    if (registry.stopped.delete(hash)) {
      void queryClient.invalidateQueries({ queryKey: key, exact: true })
    }
  }
}

function pick(item: object, fields: readonly PropertyKey[]): Fields {
  const source = item as Fields
  const out: Fields = {}
  for (const field of fields) out[field] = source[field]
  return out
}

// Whether a field still shows the guess. Writing to the cache copies an array
// or object that changed, so the guess's own array is never the one cached,
// and comparing by reference would never put it back. An unchanged one is
// kept as it was, so the cache's own comparison tells them apart.
function same(a: Fields, b: Fields, fields: readonly PropertyKey[]) {
  return fields.every(
    (field) =>
      Object.is(a[field], b[field]) ||
      replaceEqualDeep(a[field], b[field]) === a[field]
  )
}

/**
 * Shows a change to one item's fields on the click and, if the server
 * refuses it, puts back only those fields on that item.
 *
 *   const vote = optimisticFields(queryClient, {
 *     places: [{ filters: { queryKey: ['post', id] }, edit: editComment }],
 *     id: ({ commentId }) => commentId,
 *     fields: ['up', 'down', 'user_vote'],
 *     apply: (comment: Comment, { vote }) => applyVote(comment, vote),
 *   })
 *   useMutation({
 *     mutationFn,
 *     onMutate: vote.onMutate,
 *     onError: (error, _variables, context) => {
 *       vote.rollback(context)
 *       toast.error(...)
 *     },
 *   })
 *
 * A field goes back only while it still shows this click's guess: a refetch
 * or another write that changed it since is newer, and stays. A write that
 * set the same value cannot be told apart. When that write is the same change
 * reaching the server another way, such as a read sent as a chat opens, call
 * `accepted` with its variables once the server takes it.
 *
 * Nothing is snapshotted, so an accepted call leaves its guess in place. A
 * mutation whose answer can differ from the guess still refetches on
 * success. A fetch stopped on the click is sent once no click waits on that
 * query, so it costs no request `main` did not make.
 */
export function optimisticFields<TVariables, TItem extends object>(
  queryClient: QueryClient,
  options: OptimisticFields<TVariables, TItem>
) {
  const { places, fields } = options

  // Names the fields too, so a vote and a pin on the same post keep
  // separate orders.
  const chainId = (hash: string, id: string) =>
    JSON.stringify([hash, id, fields.map(String)])

  return {
    /** Pass as the mutation's `onMutate`, unwrapped. */
    onMutate: async (variables: TVariables): Promise<FieldsCall> => {
      const registry = registryFor(queryClient)
      const call = new FieldsCall()
      const id = options.id(variables)

      // A fetch already on its way would land after the guess and put the
      // old value back, so it is stopped, on the queries that hold the item
      // only: a list without it keeps its fetch. A query with no data yet is
      // left alone, as a first load cancelled here would never be sent
      // again. See `settle` for when a stopped fetch goes out.
      const holds = (data: unknown, edit: FieldsPlace<TItem>['edit']) => {
        let found = false
        edit(data as never, id, (item) => {
          found = true
          return item
        })
        return found
      }
      // An `edit` that throws here leaves nothing to undo: no fetch is
      // stopped yet and the call is not waiting.
      const holding = new Map<string, Query>()
      for (const { filters, edit } of places) {
        for (const query of queryClient.getQueryCache().findAll(filters)) {
          if (query.state.data === undefined) continue
          if (holding.has(query.queryHash)) continue
          if (holds(query.state.data, edit)) holding.set(query.queryHash, query)
        }
      }
      for (const [hash, query] of holding) {
        call.queries.set(hash, query.queryKey)
        if (
          query.state.isInvalidated ||
          query.state.fetchStatus === 'fetching'
        ) {
          registry.stopped.add(hash)
        }
        const calls = registry.waiting.get(hash) ?? new Set()
        calls.add(call)
        registry.waiting.set(hash, calls)
      }
      await Promise.all(
        [...call.queries.values()].map((queryKey) =>
          queryClient.cancelQueries({ queryKey, exact: true })
        )
      )

      // Every change is worked out before any is written or joins a chain,
      // so an `edit` or `apply` that throws leaves the cache and the click
      // order as they were, and the call stops waiting, sending any fetch it
      // stopped. A query two places
      // match is edited by the first only, so a click is never applied to it
      // twice.
      const writes: { key: QueryKey; next: unknown }[] = []
      const found: (Omit<Step, 'undo'> & { hash: string; before: Fields })[] =
        []
      try {
        const seen = new Set<string>()
        for (const place of places) {
          for (const [key, data] of queryClient.getQueriesData(place.filters)) {
            const hash = hashKey(key)
            if (data === undefined || seen.has(hash)) continue
            seen.add(hash)
            let step: (typeof found)[number] | undefined
            const next = place.edit(data as never, id, (item) => {
              const shown = options.apply(item, variables)
              if (shown === item) return item
              // The first copy of the item names what showed before.
              step ??= {
                key,
                hash,
                edit: (old, change) =>
                  place.edit(
                    old as never,
                    id,
                    change as unknown as (item: TItem) => TItem
                  ),
                before: pick(item, fields),
                after: {},
              }
              step.after = pick(shown, fields)
              return shown
            })
            if (step) found.push(step)
            if (next !== data) writes.push({ key, next })
          }
        }
      } catch (error) {
        settle(queryClient, registry, call)
        throw error
      }

      for (const { hash, before, ...step } of found) {
        const undo = registry.chain(chainId(hash, id))
        undo.remember(before)
        call.steps.push({ ...step, undo })
      }
      for (const { key, next } of writes) {
        queryClient.setQueryData(key, next, {
          updatedAt: queryClient.getQueryState(key)?.dataUpdatedAt,
        })
      }
      return call
    },

    /** The server took this change by another request than a click here.
     * Earlier clicks on the item then have nothing left to undo. */
    accepted: (variables: TVariables) => {
      const registry = registryFor(queryClient)
      const id = options.id(variables)
      for (const { filters } of places) {
        for (const query of queryClient.getQueryCache().findAll(filters)) {
          // A new last step, taken at once, clears every one before it.
          registry.chain(chainId(query.queryHash, id)).accepted()
        }
      }
    },

    /** Put back what a refused call changed. Call it first in `onError`.
     * Takes the context as TanStack hands it over; anything else is
     * ignored. */
    rollback: (call: unknown) => {
      if (!(call instanceof FieldsCall)) return
      const registry = registryFor(queryClient)
      for (const step of call.steps) {
        const before = step.undo.refused()
        if (!before) continue
        const data = queryClient.getQueryData(step.key)
        if (data === undefined) continue
        const next = step.edit(data, (item) =>
          same(pick(item, fields), step.after, fields)
            ? { ...item, ...before.value }
            : item
        )
        if (next !== data) {
          queryClient.setQueryData(step.key, next, {
            updatedAt: queryClient.getQueryState(step.key)?.dataUpdatedAt,
          })
        }
      }
      settle(queryClient, registry, call)
    },
  }
}
