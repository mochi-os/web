// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: Apache-2.0

import { useEffect, useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import * as push from '../lib/push'
import { shellOrigin, fromShell } from '../lib/shell-bridge'

// Push registration is shell-only. Apps run in sandboxed iframes with opaque
// origins where the Notification/PushManager APIs don't work, so we proxy
// subscribe/unsubscribe/status to the shell (menu app) via postMessage.

interface PushState {
  supported: boolean
  supportChecked: boolean
  permission: NotificationPermission
  subscribed: boolean
}

// Every listener goes through fromShell, which pins the source window and the
// origin: only the shell, our direct parent, may answer. Ids are a plain counter.
let shellPushIdCounter = 0

// The responder is the menu React app, not shell.js, so a shell whose menu has
// not rendered - or an older shell, or a top-window render - never answers at
// all. Without a deadline that left one listener and one pending promise per
// mount, and usePush() asks for status on EVERY mount.
const PUSH_TIMEOUT = 10000

function shellPushRequest<T>(
  request: string,
  reply: string,
  read: (data: Record<string, unknown>) => T,
  failure: string
): Promise<T> {
  const id = ++shellPushIdCounter
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      window.removeEventListener('message', onMessage)
      reject(new Error(failure))
    }, PUSH_TIMEOUT)
    function settle() {
      clearTimeout(timer)
      window.removeEventListener('message', onMessage)
    }
    function onMessage(event: MessageEvent) {
      if (!fromShell(event)) return
      const data = event.data
      if (!data || data.type !== reply || data.id !== id) return
      settle()
      if (data.ok) resolve(read(data))
      else reject(new Error(data.reason || failure))
    }
    window.addEventListener('message', onMessage)
    window.parent.postMessage({ type: request, id }, shellOrigin())
  })
}

// The failure strings are Error messages for the caller's own logging, never
// rendered: usePush catches every rejection and sets its own translated state.
// They were inline `new Error(...)` literals before the shared helper; moving
// them into argument position is what brought them under the rule.
function shellPushSubscribe(): Promise<void> {
  // eslint-disable-next-line lingui/no-unlocalized-strings -- diagnostic, not UI (see above)
  return shellPushRequest('push-subscribe', 'push-result', () => undefined, 'Push registration failed')
}

function shellPushStatus(): Promise<{ subscribed: boolean; permission: NotificationPermission }> {
  return shellPushRequest(
    'push-status',
    'push-status-result',
    (data) => ({
      subscribed: !!data.subscribed,
      permission: (data.permission as NotificationPermission) || 'default',
    }),
    // eslint-disable-next-line lingui/no-unlocalized-strings -- diagnostic, not UI
    'Push status failed'
  )
}

function shellPushUnsubscribe(): Promise<void> {
  // eslint-disable-next-line lingui/no-unlocalized-strings -- diagnostic, not UI
  return shellPushRequest('push-unsubscribe', 'push-unsubscribe-result', () => undefined, 'Push unsubscribe failed')
}

export function usePush() {
  const [state, setState] = useState<PushState>({
    supported: true,
    supportChecked: true,
    permission: push.getPermission(),
    subscribed: false,
  })

  useEffect(() => {
    shellPushStatus()
      .then(({ subscribed, permission }) =>
        setState((s) => ({ ...s, subscribed, permission }))
      )
      .catch(() => {})
  }, [])

  const subscribeMutation = useMutation({
    mutationFn: async () => {
      await shellPushSubscribe()
    },
    onSuccess: () => {
      setState((s) => ({ ...s, permission: 'granted', subscribed: true }))
    },
  })

  const unsubscribeMutation = useMutation({
    mutationFn: async () => {
      await shellPushUnsubscribe()
    },
    onSuccess: () => {
      setState((s) => ({ ...s, subscribed: false }))
    },
  })

  return {
    ...state,
    subscribe: () => subscribeMutation.mutateAsync(),
    unsubscribe: () => unsubscribeMutation.mutateAsync(),
    isSubscribing: subscribeMutation.isPending,
    isUnsubscribing: unsubscribeMutation.isPending,
  }
}
