// Copyright © 2026 Mochi OÜ
// SPDX-License-Identifier: Apache-2.0

import { useState, useEffect, useCallback } from 'react'
import { getItem, setItem } from '../lib/shell-storage'

/**
 * Like useState but persisted via shell storage (works in sandboxed iframes).
 * Returns the default value synchronously, then updates once the async read completes.
 */
export function useShellStorage<T>(key: string, defaultValue: T): [T, (value: T) => void] {
  const [value, setValue] = useState<T>(defaultValue)

  // Read from shell storage on mount
  useEffect(() => {
    let mounted = true
    getItem(key).then((stored) => {
      if (!mounted || stored == null) return
      try {
        setValue(JSON.parse(stored) as T)
      } catch {
        // Ignore parse errors
      }
    })
    return () => { mounted = false }
  }, [key])

  const set = useCallback((newValue: T) => {
    setValue(newValue)
    setItem(key, JSON.stringify(newValue))
  }, [key])

  return [value, set]
}
