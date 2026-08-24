// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: Apache-2.0

import { describe, it, expect } from 'vitest'
import { sequence } from './sequence'

/** A promise plus the handles to settle it, so a task can be held open. */
function deferred<T = void>() {
  let resolve!: (value: T) => void
  let reject!: (reason?: unknown) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

describe('sequence', () => {
  it('holds a second task until the first finishes', async () => {
    const run = sequence()
    const first = deferred()
    const order: string[] = []

    const a = run(async () => {
      order.push('a:start')
      await first.promise
      order.push('a:end')
    })
    const b = run(async () => {
      order.push('b:start')
    })

    // b must not have started while a is still awaiting.
    await Promise.resolve()
    expect(order).toEqual(['a:start'])

    first.resolve()
    await Promise.all([a, b])
    expect(order).toEqual(['a:start', 'a:end', 'b:start'])
  })

  it('lets the second task see what the first stored', async () => {
    const run = sequence()
    const first = deferred()
    let stored = ''

    const a = run(async () => {
      await first.promise
      stored = 'saved'
    })
    const b = run(async () => stored)

    first.resolve()
    await a
    expect(await b).toBe('saved')
  })

  it('runs the next task after one rejects', async () => {
    const run = sequence()
    let ran = false

    const failed = run(async () => {
      throw new Error('save failed')
    })
    const after = run(async () => {
      ran = true
    })

    await expect(failed).rejects.toThrow('save failed')
    await after
    expect(ran).toBe(true)
  })

  it('delivers a rejection only to its own caller', async () => {
    const run = sequence()
    const failed = run(async () => {
      throw new Error('save failed')
    })
    const ok = run(async () => 'fine')

    await expect(failed).rejects.toThrow('save failed')
    await expect(ok).resolves.toBe('fine')
  })

  it('returns each task’s own value', async () => {
    const run = sequence()
    const values = await Promise.all([
      run(async () => 1),
      run(async () => 2),
      run(async () => 3),
    ])
    expect(values).toEqual([1, 2, 3])
  })

  it('keeps queues independent', async () => {
    const one = sequence()
    const two = sequence()
    const held = deferred()
    const order: string[] = []

    const blocked = one(async () => {
      await held.promise
      order.push('one')
    })
    await two(async () => {
      order.push('two')
    })

    // The second queue ran while the first was still held.
    expect(order).toEqual(['two'])
    held.resolve()
    await blocked
    expect(order).toEqual(['two', 'one'])
  })
})
