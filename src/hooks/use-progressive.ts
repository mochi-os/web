// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: Apache-2.0

import { useEffect, useState } from 'react'

/** Rows drawn at once, before the first paint. */
const FIRST = 100
/** Rows added each time the browser is idle after that. */
const STEP = 200

/**
 * How many of a list's rows to draw: the first hundred at once, then two
 * hundred more each time the browser is idle, until all are drawn. Drawing a
 * thousand rows at once held the first paint for the whole of them. Every row
 * ends up in the document, so find in page, select all, printing and screen
 * readers see the whole list once it is drawn, as they would not with a
 * windowed list. A list that has shrunk to a hundred rows or fewer, as one
 * being searched does, is drawn this way again when it grows.
 */
export function useProgressive(total: number): number {
  const [shown, setShown] = useState(FIRST)
  const drawn = Math.min(total, shown)
  useEffect(() => {
    if (total <= FIRST) {
      setShown(FIRST)
      return
    }
    if (drawn >= total) return
    return later(() => setShown(drawn + STEP))
  }, [drawn, total])
  return drawn
}

// Calls back when the browser is next idle, or soon where it cannot say, and
// answers how to cancel that.
function later(callback: () => void): () => void {
  if (typeof requestIdleCallback === 'function') {
    const handle = requestIdleCallback(callback, { timeout: 200 })
    return () => cancelIdleCallback(handle)
  }
  const handle = setTimeout(callback, 0)
  return () => clearTimeout(handle)
}
