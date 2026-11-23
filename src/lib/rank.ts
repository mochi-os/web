// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: Apache-2.0

// Fractional-index rank keys (#53) - client mirror of the fractional-indexing
// in apps/projects/projects.star. The floor midpoint (`>> 1`) must match the
// Starlark `// 2`, or the optimistic preview lands where the server's key will
// not.
const D = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz'
const HEADERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz'
const SMALLEST = 'A' + '0'.repeat(26)

function intLength(head: string): number {
  const i = HEADERS.indexOf(head)
  return i >= 26 ? i - 26 + 2 : 25 - i + 2
}

function intPart(key: string): string {
  return key.slice(0, intLength(key[0]))
}

function increment(x: string): string | null {
  const head = x[0]
  const digits = x.slice(1).split('')
  let carry = true
  for (let i = digits.length - 1; carry && i >= 0; i--) {
    const d = D.indexOf(digits[i]) + 1
    if (d === 62) digits[i] = D[0]
    else {
      digits[i] = D[d]
      carry = false
    }
  }
  if (!carry) return head + digits.join('')
  if (head === 'Z') return 'a' + D[0]
  if (head === 'z') return null
  const h = HEADERS[HEADERS.indexOf(head) + 1]
  if (HEADERS.indexOf(h) >= 26) digits.push(D[0])
  else digits.pop()
  return h + digits.join('')
}

function decrement(x: string): string | null {
  const head = x[0]
  const digits = x.slice(1).split('')
  let borrow = true
  for (let i = digits.length - 1; borrow && i >= 0; i--) {
    const d = D.indexOf(digits[i]) - 1
    if (d === -1) digits[i] = D[61]
    else {
      digits[i] = D[d]
      borrow = false
    }
  }
  if (!borrow) return head + digits.join('')
  if (head === 'a') return 'Z' + D[61]
  if (head === 'A') return null
  const h = HEADERS[HEADERS.indexOf(head) - 1]
  if (HEADERS.indexOf(h) < 26) digits.push(D[61])
  else digits.pop()
  return h + digits.join('')
}

function midpoint(a: string, b: string | null): string {
  const zero = D[0]
  if (b !== null && b.length > 0) {
    let n = 0
    for (;;) {
      const ca = n < a.length ? a[n] : zero
      if (ca !== b[n]) break
      n++
      if (n >= b.length) break
    }
    if (n > 0) return b.slice(0, n) + midpoint(a.slice(n), b.slice(n))
  }
  const da = a.length > 0 ? D.indexOf(a[0]) : 0
  const db = b !== null && b.length > 0 ? D.indexOf(b[0]) : 62
  if (db - da > 1) return D[(da + db) >> 1]
  if (b !== null && b.length > 1) return b.slice(0, 1)
  return D[da] + midpoint(a.length > 0 ? a.slice(1) : '', null)
}

/** A key strictly between a and b (either null = before-all / after-all). */
export function rankBetween(a: string | null, b: string | null): string {
  if (a === null && b === null) return 'a' + D[0]
  if (a === null) {
    const ib = intPart(b!)
    const fb = b!.slice(ib.length)
    if (ib === SMALLEST) return ib + midpoint('', fb)
    if (ib < b!) return ib
    return decrement(ib)!
  }
  if (b === null) {
    const ia = intPart(a)
    const fa = a.slice(ia.length)
    const i = increment(ia)
    return i === null ? ia + midpoint(fa, null) : i
  }
  const ia = intPart(a)
  const fa = a.slice(ia.length)
  const ib = intPart(b)
  const fb = b.slice(ib.length)
  if (ia === ib) return ia + midpoint(fa, fb)
  const i = increment(ia)
  if (i !== null && i < b) return i
  return ia + midpoint(fa, null)
}

/**
 * n keys strictly between a and b (either null = open), in order. Between two
 * keys they are bisected, the middle one first and each half the same way, so
 * their length grows with the log of n, not with n; toward an open end each
 * steps on from the last, as an append does. The server's rank_spread
 * (Wallace's generateNKeysBetween).
 */
function rankSpread(a: string | null, b: string | null, n: number): string[] {
  if (n <= 0) return []
  if (n === 1) return [rankBetween(a, b)]
  if (b === null) {
    const keys = [rankBetween(a, null)]
    for (let i = 1; i < n; i++) keys.push(rankBetween(keys[i - 1], null))
    return keys
  }
  if (a === null) {
    const keys = [rankBetween(null, b)]
    for (let i = 1; i < n; i++) keys.push(rankBetween(null, keys[i - 1]))
    return keys.reverse()
  }
  const middle = n >> 1
  const key = rankBetween(a, b)
  return [
    ...rankSpread(a, key, middle),
    key,
    ...rankSpread(key, b, n - middle - 1),
  ]
}

/**
 * Lexicographic compare for opaque rank keys (BINARY order). Deliberately NOT
 * naturalCompare — these are opaque ordering keys, not user-facing strings.
 */
export function rankCompare(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0
}

interface Ranked {
  id: string
  rank: string
  created: number
}

/**
 * The keys a move writes when `moved` is dropped directly after (or before)
 * `anchor`, as the server writes them: objects sharing the anchor's key each
 * take one of their own first, spread through the gap around it in the order
 * lists show them (newest first, then the greater id), and the moved object
 * takes a key between the anchor's and the next key any object in `objects`
 * holds, so it is no other object's. Object id to new key.
 */
export function rankPlace(
  objects: Ranked[],
  moved: string,
  anchor: string,
  after: boolean
): Record<string, string> {
  const others = objects.filter((o) => o.id !== moved)
  const ranks: Record<string, string> = {}
  const target = others.find((o) => o.id === anchor)
  if (!target) return ranks
  // The nearest key above (or below) k that any object holds.
  const next = (k: string, up: boolean) =>
    others.reduce<string | null>((m, o) => {
      const r = ranks[o.id] ?? o.rank
      return (up ? r > k : r < k) && (m === null || (up ? r < m : r > m))
        ? r
        : m
    }, null)
  let key = target.rank
  const tied = others
    .filter((o) => o.rank === key)
    .sort((a, b) => b.created - a.created || rankCompare(b.id, a.id))
  if (tied.length > 1) {
    const keys = rankSpread(next(key, false), next(key, true), tied.length)
    tied.forEach((o, i) => {
      ranks[o.id] = keys[i]
      if (o.id === anchor) key = keys[i]
    })
  }
  ranks[moved] = after
    ? rankBetween(key, next(key, true))
    : rankBetween(next(key, false), key)
  return ranks
}
