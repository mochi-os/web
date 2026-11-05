// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: Apache-2.0

import { MutationObserver, QueryClient } from '@tanstack/react-query'
import { describe, expect, it, vi } from 'vitest'
import { optimisticFields, undoChain, type FieldsPlace } from './undo'

describe('undoChain', () => {
  it('puts back the value from before when the only click is refused', () => {
    const step = undoChain<number>()('a')
    step.remember(1)
    expect(step.refused()).toEqual({ value: 1 })
  })

  it('keeps only the first value remembered', () => {
    const step = undoChain<number>()('a')
    step.remember(1)
    step.remember(2)
    expect(step.refused()).toEqual({ value: 1 })
  })

  it('changes nothing for a refusal while a later click waits, then hands it the value', () => {
    const chain = undoChain<number>()
    const first = chain('a')
    const second = chain('a')
    first.remember(1)
    second.remember(2)
    expect(first.refused()).toBeNull()
    expect(second.refused()).toEqual({ value: 1 })
  })

  it('undoes nothing for an earlier click once a later one is taken', () => {
    const chain = undoChain<number>()
    const first = chain('a')
    const second = chain('a')
    first.remember(1)
    second.remember(2)
    second.accepted()
    expect(first.refused()).toBeNull()
  })

  it('goes back to the taken click when a later one is refused', () => {
    const chain = undoChain<number>()
    const first = chain('a')
    const second = chain('a')
    first.remember(1)
    second.remember(2)
    first.accepted()
    expect(second.refused()).toEqual({ value: 2 })
  })

  it('keeps each thing on its own', () => {
    const chain = undoChain<number>()
    const a = chain('a')
    const b = chain('b')
    a.remember(1)
    b.remember(5)
    b.accepted()
    expect(a.refused()).toEqual({ value: 1 })
  })
})

type Comment = { id: string; votes: number; mine: boolean; body: string }
type Post = { comments: Comment[] }

const KEY = ['post', 1]
const comment = (id: string): Comment => ({
  id,
  votes: 0,
  mine: false,
  body: id,
})
const START: Post = { comments: [comment('a'), comment('b')] }

function editComment(
  old: Post,
  id: string,
  change: (item: Comment) => Comment
): Post {
  let changed = false
  const comments = old.comments.map((item) => {
    if (item.id !== id) return item
    const next = change(item)
    changed ||= next !== item
    return next
  })
  return changed ? { ...old, comments } : old
}

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

type Vote = { id: string; mine: boolean }

function setup(
  places: FieldsPlace<Comment>[] = [
    { filters: { queryKey: KEY }, edit: editComment },
  ]
) {
  const client = new QueryClient()
  client.setQueryData(KEY, START)
  const vote = optimisticFields(client, {
    places,
    id: (variables: Vote) => variables.id,
    fields: ['votes', 'mine'],
    apply: (item: Comment, { mine }) =>
      item.mine === mine
        ? item
        : { ...item, mine, votes: item.votes + (mine ? 1 : -1) },
  })
  const requests: ReturnType<typeof deferred>[] = []
  const observer = () =>
    new MutationObserver(client, {
      mutationFn: () => {
        const request = deferred()
        requests.push(request)
        return request.promise
      },
      onMutate: vote.onMutate,
      onError: (_error, _variables, context) => vote.rollback(context),
    })
  return {
    client,
    vote,
    requests,
    // Each click its own observer, as two buttons would be.
    click: (variables: Vote) =>
      observer()
        .mutate(variables)
        .catch(() => {}),
    post: () => client.getQueryData<Post>(KEY)!,
    find: (id: string) =>
      client.getQueryData<Post>(KEY)!.comments.find((c) => c.id === id)!,
    sent: (n: number) => vi.waitFor(() => expect(requests).toHaveLength(n)),
  }
}

describe('optimisticFields', () => {
  it('shows the change before the server answers and keeps it when taken', async () => {
    const { click, find, requests, sent } = setup()
    const done = click({ id: 'a', mine: true })
    await sent(1)
    expect(find('a')).toMatchObject({ votes: 1, mine: true })
    requests[0].resolve({})
    await done
    expect(find('a')).toMatchObject({ votes: 1, mine: true })
  })

  it('puts back only the refused item when another in the same query was taken', async () => {
    const { click, find, requests, sent } = setup()
    const a = click({ id: 'a', mine: true })
    const b = click({ id: 'b', mine: true })
    await sent(2)
    requests[1].resolve({})
    await b
    requests[0].reject(new Error('refused'))
    await a
    expect(find('a')).toMatchObject({ votes: 0, mine: false })
    expect(find('b')).toMatchObject({ votes: 1, mine: true })
  })

  it('keeps other fields written while the request was out', async () => {
    const { client, click, find, requests, sent } = setup()
    const done = click({ id: 'a', mine: true })
    await sent(1)
    client.setQueryData<Post>(KEY, (old) =>
      editComment(old!, 'a', (item) => ({ ...item, body: 'edited' }))
    )
    requests[0].reject(new Error('refused'))
    await done
    expect(find('a')).toEqual({ ...comment('a'), body: 'edited' })
  })

  it('leaves a field a refetch changed since', async () => {
    const { client, click, find, requests, sent } = setup()
    const done = click({ id: 'a', mine: true })
    await sent(1)
    client.setQueryData<Post>(KEY, {
      comments: [{ ...comment('a'), votes: 7 }, comment('b')],
    })
    requests[0].reject(new Error('refused'))
    await done
    expect(find('a').votes).toBe(7)
  })

  it('changes nothing for a refusal while a later click on the item waits', async () => {
    const { click, find, requests, sent } = setup()
    const first = click({ id: 'a', mine: true })
    const second = click({ id: 'a', mine: false })
    await sent(2)
    requests[0].reject(new Error('refused'))
    await first
    expect(find('a')).toMatchObject({ votes: 0, mine: false })
    requests[1].reject(new Error('refused'))
    await second
    expect(find('a')).toMatchObject({ votes: 0, mine: false })
  })

  it('puts back what was before both when a later click is refused last', async () => {
    const { client, click, find, requests, sent } = setup()
    client.setQueryData<Post>(KEY, {
      comments: [{ ...comment('a'), votes: 4 }, comment('b')],
    })
    const first = click({ id: 'a', mine: true })
    const second = click({ id: 'a', mine: false })
    // A third click puts the vote on again, so the later refusal has a guess
    // of its own to undo.
    const third = click({ id: 'a', mine: true })
    await sent(3)
    expect(find('a')).toMatchObject({ votes: 5, mine: true })
    requests[0].reject(new Error('refused'))
    requests[1].reject(new Error('refused'))
    await Promise.all([first, second])
    expect(find('a')).toMatchObject({ votes: 5, mine: true })
    requests[2].reject(new Error('refused'))
    await third
    expect(find('a')).toMatchObject({ votes: 4, mine: false })
  })

  it('undoes nothing for an earlier click once a later one is taken', async () => {
    const { click, find, requests, sent } = setup()
    const first = click({ id: 'a', mine: true })
    const second = click({ id: 'a', mine: false })
    await sent(2)
    requests[1].resolve({})
    await second
    requests[0].reject(new Error('refused'))
    await first
    expect(find('a')).toMatchObject({ votes: 0, mine: false })
  })

  it('goes back to the taken click when a later one is refused', async () => {
    const { click, find, requests, sent } = setup()
    const first = click({ id: 'a', mine: true })
    const second = click({ id: 'a', mine: false })
    await sent(2)
    requests[0].resolve({})
    await first
    requests[1].reject(new Error('refused'))
    await second
    expect(find('a')).toMatchObject({ votes: 1, mine: true })
  })

  it('writes nothing for a click that changes nothing', async () => {
    const { client, click, post, requests, sent } = setup()
    const count = () => client.getQueryState(KEY)?.dataUpdateCount
    const before = count()
    const data = post()
    const done = click({ id: 'a', mine: false })
    await sent(1)
    requests[0].reject(new Error('refused'))
    await done
    expect(post()).toBe(data)
    expect(count()).toBe(before)
  })

  it('puts the item back in every place that holds it', async () => {
    const LIST = ['list']
    const { client, click, find, requests, sent } = setup([
      { filters: { queryKey: KEY }, edit: editComment },
      {
        filters: { queryKey: LIST },
        edit: (old: Comment[], id, change) => {
          const next = old.map((item) => (item.id === id ? change(item) : item))
          return next.some((item, i) => item !== old[i]) ? next : old
        },
      },
    ])
    client.setQueryData(LIST, [comment('a')])
    const done = click({ id: 'a', mine: true })
    await sent(1)
    expect(client.getQueryData<Comment[]>(LIST)![0].mine).toBe(true)
    expect(find('a').mine).toBe(true)
    requests[0].reject(new Error('refused'))
    await done
    expect(client.getQueryData<Comment[]>(LIST)![0].mine).toBe(false)
    expect(find('a').mine).toBe(false)
  })

  it('stops a fetch already on its way and sends it again once nothing waits', async () => {
    const { client, click, find, requests, sent } = setup()
    const invalidate = vi.spyOn(client, 'invalidateQueries')
    const slow = deferred()
    const fetching = client
      .fetchQuery({ queryKey: KEY, queryFn: () => slow.promise })
      .catch(() => {})
    const first = click({ id: 'a', mine: true })
    const second = click({ id: 'b', mine: true })
    await sent(2)
    slow.resolve(START)
    await fetching
    expect(find('a').mine).toBe(true)

    requests[0].resolve({})
    await first
    expect(invalidate).not.toHaveBeenCalled()
    requests[1].resolve({})
    await second
    expect(invalidate).toHaveBeenCalledTimes(1)
    expect(invalidate).toHaveBeenCalledWith({ queryKey: KEY, exact: true })
    expect(client.getQueryState(KEY)?.isInvalidated).toBe(true)
  })

  it('leaves the fetch of a query without the item', async () => {
    const OTHER = ['other']
    const { client, click, requests, sent } = setup([
      { filters: { queryKey: KEY }, edit: editComment },
      { filters: { queryKey: OTHER }, edit: editComment },
    ])
    client.setQueryData<Post>(OTHER, { comments: [comment('z')] })
    const slow = deferred()
    const fetching = client.fetchQuery({
      queryKey: OTHER,
      queryFn: () => slow.promise,
    })
    const done = click({ id: 'a', mine: true })
    await sent(1)
    slow.resolve({ comments: [comment('y')] })
    await fetching
    expect(client.getQueryData<Post>(OTHER)!.comments[0].id).toBe('y')
    requests[0].resolve({})
    await done
  })

  it('sends no request of its own when no fetch was stopped', async () => {
    const { client, click, requests, sent } = setup()
    const invalidate = vi.spyOn(client, 'invalidateQueries')
    const accepted = click({ id: 'a', mine: true })
    const refused = click({ id: 'b', mine: true })
    await sent(2)
    requests[0].resolve({})
    requests[1].reject(new Error('refused'))
    await Promise.all([accepted, refused])
    expect(invalidate).not.toHaveBeenCalled()
  })

  it('puts nothing back once the same change was taken another way', async () => {
    const { click, find, requests, sent, vote } = setup()
    const done = click({ id: 'a', mine: true })
    await sent(1)
    vote.accepted({ id: 'a', mine: true })
    requests[0].reject(new Error('refused'))
    await done
    expect(find('a')).toMatchObject({ votes: 1, mine: true })
  })

  it('still puts back another item after one was taken another way', async () => {
    const { click, find, requests, sent, vote } = setup()
    const done = click({ id: 'a', mine: true })
    await sent(1)
    vote.accepted({ id: 'b', mine: true })
    requests[0].reject(new Error('refused'))
    await done
    expect(find('a')).toMatchObject({ votes: 0, mine: false })
  })

  it('leaves everything as it was when an edit throws', async () => {
    const LIST = ['list']
    let broken = true
    const { client, click, find, requests, sent } = setup([
      { filters: { queryKey: KEY }, edit: editComment },
      {
        filters: { queryKey: LIST },
        // Finds the item, then throws on the change itself.
        edit: (old: Post, id, change) => {
          const next = editComment(old, id, change)
          if (broken && next !== old) throw new Error('broken')
          return next
        },
      },
    ])
    client.setQueryData<Post>(LIST, { comments: [comment('a')] })
    client.setQueryData<Post>(KEY, {
      comments: [{ ...comment('a'), votes: 4 }, comment('b')],
    })
    const invalidate = vi.spyOn(client, 'invalidateQueries')
    void client.invalidateQueries({ queryKey: KEY, refetchType: 'none' })
    invalidate.mockClear()

    await click({ id: 'a', mine: true })
    expect(requests).toHaveLength(0)
    expect(find('a')).toMatchObject({ votes: 4, mine: false })
    // The fetch the click stopped is still sent once nothing waits.
    expect(invalidate).toHaveBeenCalledWith({ queryKey: KEY, exact: true })

    // A later click on the item is undone as if the broken one never was.
    broken = false
    const done = click({ id: 'a', mine: true })
    await sent(1)
    expect(find('a')).toMatchObject({ votes: 5, mine: true })
    requests[0].reject(new Error('refused'))
    await done
    expect(find('a')).toMatchObject({ votes: 4, mine: false })
  })

  it('leaves everything as it was when finding the item throws', async () => {
    const LIST = ['list']
    let broken = true
    const { client, click, find, requests, sent } = setup([
      { filters: { queryKey: KEY }, edit: editComment },
      {
        filters: { queryKey: LIST },
        edit: (old: Post, id, change) => {
          if (broken) throw new Error('broken')
          return editComment(old, id, change)
        },
      },
    ])
    client.setQueryData<Post>(LIST, { comments: [comment('a')] })
    await click({ id: 'a', mine: true })
    expect(requests).toHaveLength(0)
    expect(find('a')).toMatchObject({ votes: 0, mine: false })

    broken = false
    const done = click({ id: 'a', mine: true })
    await sent(1)
    requests[0].reject(new Error('refused'))
    await done
    expect(find('a')).toMatchObject({ votes: 0, mine: false })
  })

  it('ignores a context it did not make', () => {
    const { vote, post } = setup()
    const data = post()
    vote.rollback(undefined)
    vote.rollback({})
    expect(post()).toBe(data)
  })
})
