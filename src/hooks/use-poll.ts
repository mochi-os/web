// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: Apache-2.0

import { useEffect, useRef } from 'react'

// The wait before the first call, in milliseconds; each wait after it is twice
// the last, up to the maximum, and the calls stop once the next would fall past
// the limit.
const initial = 3000
const maximum = 60000
const limit = 600000

/**
 * Calls poll while active holds: first after 3 seconds, then after twice the
 * last wait, a minute apart at most, and no more once 10 minutes have passed.
 * A page waiting on the server - a subscription still filling - polls as a
 * fallback for a missed websocket message, and stops rather than polling for
 * ever when what it waits on never comes. Clearing active, or a change of key
 * (another item shown by the same page), starts over from 3 seconds.
 */
export function usePoll(active: boolean, poll: () => void, key?: string) {
  const latest = useRef(poll)
  useEffect(() => {
    latest.current = poll
  })

  useEffect(() => {
    if (!active) return
    let wait = initial
    let elapsed = 0
    let timer: ReturnType<typeof setTimeout> | undefined
    // Set by the cleanup, which a poll can run itself: one that clears active
    // or unmounts the page synchronously cleans up before the next call is
    // scheduled, and that call must not be.
    let cancelled = false
    const schedule = () => {
      if (cancelled || elapsed + wait > limit) return
      timer = setTimeout(() => {
        elapsed += wait
        wait = Math.min(wait * 2, maximum)
        latest.current()
        schedule()
      }, wait)
    }
    schedule()
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [active, key])
}
