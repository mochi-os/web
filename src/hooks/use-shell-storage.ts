// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: Apache-2.0

import { useState, useEffect, useCallback } from 'react'
import { getItem, setItem } from '../lib/shell-storage'

/**
 * Like useState but persisted via shell storage (works in sandboxed iframes).
 * Returns the default value synchronously, then updates once the async read
 * completes. The third value says whether that read has answered, for a
 * caller that must not act on the default meanwhile.
 */
export function useShellStorage<T>(
  key: string,
  defaultValue: T
): [T, (value: T) => void, boolean] {
  const [value, setValue] = useState<T>(defaultValue)
  const [known, setKnown] = useState(false)

  // Read from shell storage on mount
  useEffect(() => {
    let mounted = true
    setKnown(false)
    getItem(key).then((stored) => {
      if (!mounted) return
      setKnown(true)
      if (stored == null) return
      try {
        setValue(JSON.parse(stored) as T)
      } catch {
        // Ignore parse errors
      }
    })
    return () => {
      mounted = false
    }
  }, [key])

  const set = useCallback(
    (newValue: T) => {
      setValue(newValue)
      setKnown(true)
      setItem(key, JSON.stringify(newValue))
    },
    [key]
  )

  return [value, set, known]
}
