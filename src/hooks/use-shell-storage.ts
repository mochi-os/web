// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: Apache-2.0

import { useState, useEffect, useCallback, useRef } from 'react'
import { getItem, setItem } from '../lib/shell-storage'

/**
 * Like useState but persisted via shell storage (works in sandboxed iframes).
 * Returns the default value synchronously, then updates once the async read
 * completes, unless the caller has set a value for the key meanwhile: that
 * value is newer than the one read. The third value says whether the value is
 * known (read or set), for a caller that must not act on the default meanwhile.
 */
export function useShellStorage<T>(
  key: string,
  defaultValue: T
): [T, (value: T) => void, boolean] {
  const [value, setValue] = useState<T>(defaultValue)
  const [known, setKnown] = useState(false)
  // The key set since its stored value was last read, or since mount: the
  // read answering after the set holds the older value.
  const written = useRef<string | null>(null)

  // Read from shell storage on mount and whenever the key changes
  useEffect(() => {
    let mounted = true
    // A set under an earlier key says nothing about this one.
    if (written.current !== key) written.current = null
    setKnown(written.current === key)
    getItem(key).then((stored) => {
      if (!mounted) return
      setKnown(true)
      const stale = written.current === key
      written.current = null
      if (stale || stored == null) return
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
      written.current = key
      setValue(newValue)
      setKnown(true)
      setItem(key, JSON.stringify(newValue))
    },
    [key]
  )

  return [value, set, known]
}
