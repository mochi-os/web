// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: Apache-2.0

import { useEffect, useRef, useState } from 'react'
import { useBlocker } from '@tanstack/react-router'

import {
  isInShell,
  onShellMessage,
  shellAnswerLeave,
  shellSetUnsaved,
} from '../lib/shell-bridge'

type Place = { pathname: string }

/**
 * Holds a navigation away from a page with unsaved edits until the user
 * answers. The page's own links go through the router's blocker. Inside the
 * shell, back, forward and a cross-app link replace the frame without the
 * router seeing them, so the shell asks the page first, and an unload of the
 * shell gets the browser's own prompt.
 *
 * `leaves` says which router navigations leave the page; by default a change
 * of path, so a page keeping its own state in the search moves within itself.
 *
 * While `asking`, the page shows its confirmation: `proceed` leaves, `stay`
 * stays. A page that saves and then navigates calls `release` first, so its
 * own navigation is not held: the edits it just saved still differ from what
 * it loaded until the next render.
 */
export function useLeaveGuard(
  unsaved: boolean,
  leaves: (current: Place, next: Place) => boolean = (current, next) =>
    current.pathname !== next.pathname
) {
  // Read when a navigation starts, which can be before the next render: a page
  // that clears its edits and navigates in one handler must not be held.
  const held = useRef(unsaved)
  held.current = unsaved

  const blocker = useBlocker({
    shouldBlockFn: ({ current, next }) => held.current && leaves(current, next),
    enableBeforeUnload: () => held.current,
    withResolver: true,
  })

  const [asked, setAsked] = useState(false)

  useEffect(() => {
    shellSetUnsaved(unsaved)
  }, [unsaved])

  // A page that goes away holds nothing.
  useEffect(() => () => shellSetUnsaved(false), [])

  useEffect(() => {
    if (!isInShell()) return
    return onShellMessage((message) => {
      if (message.type === 'leave-request') setAsked(true)
    })
  }, [])

  const blocked = blocker.status === 'blocked'

  return {
    asking: blocked || asked,
    proceed: () => {
      held.current = false
      if (blocked) blocker.proceed?.()
      if (asked) {
        setAsked(false)
        shellAnswerLeave(true)
      }
    },
    stay: () => {
      if (blocked) blocker.reset?.()
      if (asked) {
        setAsked(false)
        shellAnswerLeave(false)
      }
    },
    release: () => {
      held.current = false
      shellSetUnsaved(false)
    },
  }
}
