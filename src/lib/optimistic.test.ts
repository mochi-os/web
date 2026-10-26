// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: Apache-2.0

import { MutationObserver, QueryClient } from '@tanstack/react-query'
import { describe, expect, it, vi } from 'vitest'
import { optimistic, type OptimisticPatch } from './optimistic'

type Item = { on: boolean; count: number }

const START: Item = { on: false, count: 0 }

// A request the test answers by hand.
function deferred() {
  let resolve!: (value: unknown) => void
  let reject!: (error: unknown) => void
  const promise = new Promise((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

function setup(
  patches: (count: number) => OptimisticPatch[] = (count) => [
    {
      filters: { queryKey: ['item', 1], exact: true },
      update: (old: Item) => ({ ...old, count }),
    },
  ]
) {
  const client = new QueryClient()
  client.setQueryData(['item', 1], START)
  const patch = optimistic(client, patches)
  const requests: ReturnType<typeof deferred>[] = []
  const errors: unknown[] = []
  const observer = new MutationObserver(client, {
    mutationFn: () => {
      const request = deferred()
      requests.push(request)
      return request.promise
    },
    onMutate: patch.onMutate,
    onError: (error, _variables, context) => {
      patch.rollback(context)
      errors.push(error)
    },
  })
  return {
    client,
    requests,
    errors,
    click: (count: number) => observer.mutate(count).catch(() => {}),
    item: () => client.getQueryData<Item>(['item', 1]),
    sent: (n: number) => vi.waitFor(() => expect(requests).toHaveLength(n)),
  }
}

describe('optimistic', () => {
  it('shows the change before the server answers', async () => {
    const { click, item, requests, sent } = setup()
    const done = click(1)
    await sent(1)
    expect(item()).toEqual({ on: false, count: 1 })
    requests[0].resolve({})
    await done
    expect(item()).toEqual({ on: false, count: 1 })
  })

  it('puts the old value back when the server refuses', async () => {
    const { click, item, requests, errors, sent } = setup()
    const done = click(1)
    await sent(1)
    requests[0].reject(new Error('refused'))
    await done
    expect(item()).toEqual(START)
    expect(errors).toHaveLength(1)
  })

  it('sends no request of its own, accepted or refused', async () => {
    const { client, click, requests, sent } = setup()
    const invalidate = vi.spyOn(client, 'invalidateQueries')
    const refetch = vi.spyOn(client, 'refetchQueries')
    const fetch = vi.spyOn(client, 'fetchQuery')
    const accepted = click(1)
    await sent(1)
    requests[0].resolve({})
    await accepted
    const refused = click(2)
    await sent(2)
    requests[1].reject(new Error('refused'))
    await refused
    expect(invalidate).not.toHaveBeenCalled()
    expect(refetch).not.toHaveBeenCalled()
    expect(fetch).not.toHaveBeenCalled()
  })

  it('stops a fetch already on its way from undoing the change', async () => {
    const { client, click, item, sent } = setup()
    const slow = deferred()
    const fetching = client
      .fetchQuery({ queryKey: ['item', 1], queryFn: () => slow.promise })
      .catch(() => {})
    click(1)
    await sent(1)
    slow.resolve({ on: true, count: 5 })
    await fetching
    expect(item()).toEqual({ on: false, count: 1 })
  })

  it('keeps a later click when an earlier one is refused', async () => {
    const { click, item, requests, sent } = setup()
    const first = click(1)
    const second = click(2)
    await sent(2)
    requests[0].reject(new Error('refused'))
    await first
    expect(item()?.count).toBe(2)
    requests[1].resolve({})
    await second
    expect(item()?.count).toBe(2)
  })

  it('goes back to the start when both clicks are refused, first one first', async () => {
    const { click, item, requests, sent } = setup()
    const first = click(1)
    const second = click(2)
    await sent(2)
    requests[0].reject(new Error('refused'))
    await first
    requests[1].reject(new Error('refused'))
    await second
    expect(item()).toEqual(START)
  })

  it('goes back to the start when both clicks are refused, last one first', async () => {
    const { click, item, requests, sent } = setup()
    const first = click(1)
    const second = click(2)
    await sent(2)
    requests[1].reject(new Error('refused'))
    await second
    // The first click is still waiting, so its value comes back.
    expect(item()?.count).toBe(1)
    requests[0].reject(new Error('refused'))
    await first
    expect(item()).toEqual(START)
  })

  it('goes back to an accepted click when a later one is refused', async () => {
    const { click, item, requests, sent } = setup()
    const first = click(1)
    const second = click(2)
    await sent(2)
    requests[0].resolve({})
    await first
    requests[1].reject(new Error('refused'))
    await second
    expect(item()?.count).toBe(1)
  })

  it('keeps data a refetch brought in over the snapshot', async () => {
    const { client, click, item, requests, sent } = setup()
    const done = click(1)
    await sent(1)
    client.setQueryData(['item', 1], { on: true, count: 9 })
    requests[0].reject(new Error('refused'))
    await done
    expect(item()).toEqual({ on: true, count: 9 })
  })

  it('patches every query a prefix matches and skips one with no data', async () => {
    const update = vi.fn((old: Item) => ({ ...old, on: true }))
    const { client, click, requests, sent } = setup(() => [
      { filters: { queryKey: ['list'] }, update },
    ])
    client.setQueryData(['list', 'a'], START)
    client.setQueryData(['list', 'b'], START)
    client.getQueryCache().build(client, { queryKey: ['list', 'c'] })
    const done = click(1)
    await sent(1)
    expect(update).toHaveBeenCalledTimes(2)
    expect(client.getQueryData(['list', 'a'])).toEqual({ on: true, count: 0 })
    expect(client.getQueryData(['list', 'b'])).toEqual({ on: true, count: 0 })
    expect(client.getQueryData(['list', 'c'])).toBeUndefined()
    requests[0].reject(new Error('refused'))
    await done
    expect(client.getQueryData(['list', 'a'])).toEqual(START)
    expect(client.getQueryData(['list', 'b'])).toEqual(START)
  })

  it('leaves a query alone when its update returns it unchanged', async () => {
    const { client, click, requests, sent } = setup(() => [
      {
        filters: { queryKey: ['item', 1], exact: true },
        update: (old: Item) => old,
      },
    ])
    const writes = () => client.getQueryState(['item', 1])?.dataUpdateCount
    const before = writes()
    const done = click(1)
    await sent(1)
    expect(writes()).toBe(before)
    requests[0].reject(new Error('refused'))
    await done
    expect(writes()).toBe(before)
  })

  it('applies two patches on one query in turn', async () => {
    const { click, item, requests, sent } = setup((count) => [
      {
        filters: { queryKey: ['item', 1], exact: true },
        update: (old: Item) => ({ ...old, count }),
      },
      {
        filters: { queryKey: ['item'] },
        update: (old: Item) => ({ ...old, on: true }),
      },
    ])
    const done = click(3)
    await sent(1)
    expect(item()).toEqual({ on: true, count: 3 })
    requests[0].reject(new Error('refused'))
    await done
    expect(item()).toEqual(START)
  })

  it('changes nothing and sends nothing when an update throws', async () => {
    const { client, click, item, requests, errors } = setup(() => [
      {
        filters: { queryKey: ['item', 1], exact: true },
        update: (old: Item) => ({ ...old, count: 1 }),
      },
      {
        filters: { queryKey: ['other'], exact: true },
        update: () => {
          throw new Error('broken update')
        },
      },
    ])
    client.setQueryData(['other'], START)
    await click(1)
    expect(requests).toHaveLength(0)
    expect(errors).toHaveLength(1)
    expect(item()).toEqual(START)
  })
})
