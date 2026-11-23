// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: Apache-2.0

import { describe, it, expect } from 'vitest'
import { rankCompare, rankPlace } from './rank'

const object = (id: string, rank: string, created = 0) => ({
  id,
  rank,
  created,
})

/** The ids in the order their keys put them, after `ranks` is applied. */
function order(
  objects: { id: string; rank: string }[],
  ranks: Record<string, string>
) {
  return objects
    .map((o) => ({ id: o.id, rank: ranks[o.id] ?? o.rank }))
    .sort((a, b) => rankCompare(a.rank, b.rank))
    .map((o) => o.id)
}

describe('rankPlace', () => {
  it('mints a key no other object holds, though a card elsewhere sits between the neighbours', () => {
    // a and c share a column; b, in another column, holds the key halfway
    // between theirs, the key a midpoint of the column alone would mint.
    const objects = [
      object('a', 'a0'),
      object('b', 'a1'),
      object('c', 'a2'),
      object('m', 'a5'),
    ]
    const ranks = rankPlace(objects, 'm', { after: 'a' })
    expect(Object.keys(ranks)).toEqual(['m'])
    expect(ranks.m > 'a0' && ranks.m < 'a1').toBe(true)
    expect(order(objects, ranks)).toEqual(['a', 'm', 'b', 'c'])
  })

  it('puts a card dropped above one that shares its key with a nested card above both', () => {
    // A column's top card, Air, shares its key with its own child, Carrier,
    // and two children of another card sit above them both.
    const objects = [
      object('prefetch', 'aH'),
      object('library', 'aI'),
      object('air', 'b3j', 2),
      object('carrier', 'b3j', 1),
      object('openid', 'b3jV'),
      object('performance', 'b4Q'),
    ]
    const ranks = rankPlace(objects, 'openid', { before: 'air' })
    // The two that shared a key each have their own, in the order the list
    // showed them (the newer first), and the moved card is above both.
    expect(ranks.air).not.toBe(ranks.carrier)
    expect(order(objects, ranks)).toEqual([
      'prefetch',
      'library',
      'openid',
      'air',
      'carrier',
      'performance',
    ])
  })

  it('places a card dropped after the first of two that shared a key between them', () => {
    const objects = [
      object('x', 'a0'),
      object('p', 'a1', 2),
      object('q', 'a1', 1),
      object('m', 'a3'),
    ]
    const ranks = rankPlace(objects, 'm', { after: 'p' })
    expect(order(objects, ranks)).toEqual(['x', 'p', 'm', 'q'])
  })

  it('unties objects made in one second greater id first, as the list orders them', () => {
    // Ids are time-ordered, so the greater is the newer, as created desc puts
    // the newer first across seconds.
    const objects = [
      object('x', 'a0'),
      object('p1', 'a1', 5),
      object('p2', 'a1', 5),
      object('m', 'a3'),
    ]
    const ranks = rankPlace(objects, 'm', { after: 'p2' })
    expect(order(objects, ranks)).toEqual(['x', 'p2', 'm', 'p1'])
  })

  it('spreads a thousand tied keys so their length grows with the log of the tie', () => {
    const tied = Array.from({ length: 1000 }, (_, i) =>
      object(`t${i}`, 'a1', i)
    )
    const objects = [
      object('lo', 'a0'),
      ...tied,
      object('hi', 'a2'),
      object('m', 'a5'),
    ]
    const ranks = rankPlace(objects, 'm', { after: 't500' })
    const newest = [...tied].reverse().map((o) => o.id)
    // Each tied object has a key of its own, in the list's order (newest
    // first), all between the neighbours either side of the tie.
    expect(order(objects, ranks)).toEqual([
      'lo',
      ...newest.slice(0, newest.indexOf('t500') + 1),
      'm',
      ...newest.slice(newest.indexOf('t500') + 1),
      'hi',
    ])
    const lengths = tied.map((o) => ranks[o.id].length)
    expect(Math.max(...lengths)).toBeLessThanOrEqual(6)
  })

  it('unties keys toward an open end in the list order', () => {
    const tie = [
      object('p', 'a3', 3),
      object('q', 'a3', 2),
      object('r', 'a3', 1),
    ]
    // Nothing below the tie: its keys step down from the one above it.
    const top = [...tie, object('hi', 'a5'), object('m', 'a9')]
    expect(order(top, rankPlace(top, 'm', { before: 'q' }))).toEqual([
      'p',
      'm',
      'q',
      'r',
      'hi',
    ])
    // Nothing above it: they step up from the one below it.
    const bottom = [object('m', 'a0'), object('lo', 'a1'), ...tie]
    expect(order(bottom, rankPlace(bottom, 'm', { after: 'q' }))).toEqual([
      'lo',
      'p',
      'q',
      'm',
      'r',
    ])
    // Nothing either side.
    const alone = [...tie, object('m', 'a9')]
    expect(order(alone, rankPlace(alone, 'm', { after: 'p' }))).toEqual([
      'p',
      'm',
      'q',
      'r',
    ])
  })

  it('writes nothing for an anchor that is not among the objects', () => {
    expect(rankPlace([object('a', 'a0')], 'a', { after: 'gone' })).toEqual({})
  })

  describe('with both neighbours named', () => {
    // x and y in To Do, with z and w of Done holding keys between them.
    const card = (id: string, rank: string, column: string) => ({
      ...object(id, rank),
      column,
    })
    const objects = [
      card('x', 'a0', 'todo'),
      card('z', 'a1', 'done'),
      card('w', 'a1V', 'done'),
      card('y', 'a2', 'todo'),
      card('m', 'a5', 'todo'),
    ]
    const todo = (o: { column: string }) => o.column === 'todo'

    it('places the object directly after the one after', () => {
      const ranks = rankPlace(objects, 'm', { after: 'z', before: 'y' })
      expect(order(objects, ranks)).toEqual(['x', 'z', 'm', 'w', 'y'])
    })

    it('places it directly before the one before when the one after is gone', () => {
      const ranks = rankPlace(objects, 'm', { after: 'gone', before: 'y' })
      expect(order(objects, ranks)).toEqual(['x', 'z', 'w', 'm', 'y'])
    })

    it('places it directly before the one before when the one after is in another column', () => {
      const ranks = rankPlace(objects, 'm', { after: 'z', before: 'y' }, todo)
      expect(order(objects, ranks)).toEqual(['x', 'z', 'w', 'm', 'y'])
    })

    it('writes nothing when neither will do', () => {
      expect(
        rankPlace(objects, 'm', { after: 'gone', before: 'w' }, todo)
      ).toEqual({})
    })
  })
})
