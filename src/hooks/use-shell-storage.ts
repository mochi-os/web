// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: Apache-2.0

import { useState, useEffect, useCallback, useRef } from 'react'
import { getItem, setItem } from '../lib/shell-storage'

/**
 * A new value, or a function from the value to the next one. The function
 * form is for a change built on what is stored - an id added or taken out -
 * so it is applied to the stored value even when it is made before the shell
 * has answered. A stored value is JSON, so it is never itself a function.
 *
 * Such a function may run twice, once on the value shown and again on the
 * stored value, so it must say what the user asked for whatever it is given:
 * "this calendar hidden", decided from the value on screen when they clicked,
 * never "the opposite of what is there", which on a stored value the screen
 * had not caught up with undoes the click.
 */
export type ShellStorageUpdate<T> = T | ((previous: T) => T)

/**
 * Like useState but persisted via shell storage (works in sandboxed iframes).
 * Returns the default value synchronously, then updates once the async read
 * completes, unless the caller has set a value for the key meanwhile: that
 * value is newer than the one read. A key with nothing stored reads as its
 * default, so a new key never carries the last key's value. The third value
 * says whether the value is known (read or set), for a caller that must not
 * act on the default meanwhile.
 *
 * A function passed to the setter is applied to the latest value. Made before
 * the read answers, it shows at once on the value shown, and is applied again
 * to the stored value when the read comes back, which is what is kept: a
 * click in that window adds to what was stored instead of replacing it with
 * the default and one change.
 */
export function useShellStorage<T>(
  key: string,
  defaultValue: T
): [T, (update: ShellStorageUpdate<T>) => void, boolean] {
  const [value, setValue] = useState<T>(defaultValue)
  const [known, setKnown] = useState(false)
  // The key set since its stored value was last read, or since mount: the
  // read answering after the set holds the older value.
  const written = useRef<string | null>(null)
  // The key whose stored value the hook holds (read, or set outright), so a
  // function update for it applies at once rather than waiting on the read.
  const ready = useRef<string | null>(null)
  // The value as of the latest set or read: what a function update applies
  // to, so two in one event compose instead of both building on one render.
  const latest = useRef<T>(value)
  // Function updates made before their key's read answered, to be applied to
  // the stored value when it does, with the default they fall back on: by key,
  // since the key can change while a read of the last one is in flight.
  const pending = useRef(
    new Map<string, { fallback: T; updates: ((previous: T) => T)[] }>()
  )
  // The key the hook is showing now, for a read answering after a change.
  const shown = useRef(key)
  const fallback = useRef(defaultValue)
  useEffect(() => {
    fallback.current = defaultValue
  })

  // Read from shell storage on mount and whenever the key changes
  useEffect(() => {
    let mounted = true
    shown.current = key
    // A set under an earlier key says nothing about this one.
    if (written.current !== key) written.current = null
    ready.current = written.current === key ? key : null
    setKnown(written.current === key)
    getItem(key).then((stored) => {
      // Updates made before any read of the key answered are applied to the
      // stored value by whichever read answers first, even one whose effect
      // has gone (StrictMode's first, or the key changed meanwhile), so they
      // are kept whatever happens to the component.
      const queued = pending.current.get(key)
      if (queued) {
        pending.current.delete(key)
        let next = queued.fallback
        if (stored != null) {
          try {
            next = JSON.parse(stored) as T
          } catch {
            // Ignore parse errors
          }
        }
        for (const update of queued.updates) next = update(next)
        setItem(key, JSON.stringify(next))
        if (shown.current === key) {
          // Any other read of the key in flight was answered before this
          // write, so it holds the value the updates were applied to.
          written.current = key
          ready.current = key
          latest.current = next
          setValue(next)
          setKnown(true)
        }
        return
      }
      if (!mounted) return
      setKnown(true)
      ready.current = key
      const stale = written.current === key
      written.current = null
      if (stale) return
      // Nothing stored (or nothing readable) is the key's default, not the
      // value the last key left on screen: a change made next builds on it.
      let next = fallback.current
      if (stored != null) {
        try {
          next = JSON.parse(stored) as T
        } catch {
          // Ignore parse errors
        }
      }
      latest.current = next
      setValue(next)
    })
    return () => {
      mounted = false
    }
  }, [key])

  const set = useCallback(
    (update: ShellStorageUpdate<T>) => {
      if (typeof update !== 'function') {
        // A whole value replaces whatever was stored and anything queued.
        pending.current.delete(key)
        written.current = key
        ready.current = key
        latest.current = update
        setValue(update)
        setKnown(true)
        setItem(key, JSON.stringify(update))
        return
      }
      const change = update as (previous: T) => T
      const next = change(latest.current)
      latest.current = next
      setValue(next)
      if (ready.current === key) {
        written.current = key
        setKnown(true)
        setItem(key, JSON.stringify(next))
        return
      }
      // The stored value is not known yet: show the change now, and apply it
      // to the stored value when the read answers.
      let queued = pending.current.get(key)
      if (!queued) {
        queued = { fallback: fallback.current, updates: [] }
        pending.current.set(key, queued)
      }
      queued.updates.push(change)
    },
    [key]
  )

  return [value, set, known]
}
