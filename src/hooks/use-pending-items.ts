// Copyright © 2026 Mochi OÜ
// SPDX-License-Identifier: Apache-2.0

import { useCallback, useRef, useState } from 'react'

interface UsePendingItemsResult {
  count: number
  add: (id?: string, group?: string) => void
  clear: () => string[]
}

export function usePendingItems(): UsePendingItemsResult {
  const itemsRef = useRef<Map<string, string | undefined>>(new Map())
  const [count, setCount] = useState(0)

  const add = useCallback((id?: string, group?: string) => {
    const key =
      id ?? `pending-${Date.now()}-${Math.random().toString(36).slice(2)}`
    if (itemsRef.current.has(key)) return
    itemsRef.current.set(key, group)
    setCount(itemsRef.current.size)
  }, [])

  const clear = useCallback((): string[] => {
    const groups = Array.from(
      new Set(
        Array.from(itemsRef.current.values()).filter(
          (g): g is string => Boolean(g)
        )
      )
    )
    itemsRef.current.clear()
    setCount(0)
    return groups
  }, [])

  return { count, add, clear }
}
