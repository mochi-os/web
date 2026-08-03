// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: Apache-2.0

import { useEffect, useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import * as push from '../lib/push'

// Push registration is shell-only. Apps run in sandboxed iframes with opaque
// origins where the Notification/PushManager APIs don't work, so we proxy
// subscribe/unsubscribe/status to the shell (menu app) via postMessage.

interface PushState {
  supported: boolean
  supportChecked: boolean
  permission: NotificationPermission
  subscribed: boolean
}

// Request ids are a plain counter, so they are trivial to guess, and the only
// other thing a reply is matched on is a fixed type string. Every listener here
// therefore pins the source window: only the shell, our direct parent, may
// answer. The iframe's own origin is opaque so event.origin cannot be pinned
// instead, which is why the main bridge and the storage proxy guard the same
// way — see shell-bridge.ts and shell-storage.ts.
let shellPushIdCounter = 0

function shellPushSubscribe(): Promise<void> {
  const id = ++shellPushIdCounter
  return new Promise((resolve, reject) => {
    function onMessage(event: MessageEvent) {
      if (event.source !== window.parent) return
      const data = event.data
      if (!data || data.type !== 'push-result' || data.id !== id) return
      window.removeEventListener('message', onMessage)
      if (data.ok) resolve()
      else reject(new Error(data.reason || 'Push registration failed'))
    }
    window.addEventListener('message', onMessage)
    window.parent.postMessage({ type: 'push-subscribe', id }, '*')
  })
}

function shellPushStatus(): Promise<{ subscribed: boolean; permission: NotificationPermission }> {
  const id = ++shellPushIdCounter
  return new Promise((resolve, reject) => {
    function onMessage(event: MessageEvent) {
      if (event.source !== window.parent) return
      const data = event.data
      if (!data || data.type !== 'push-status-result' || data.id !== id) return
      window.removeEventListener('message', onMessage)
      if (data.ok) resolve({ subscribed: !!data.subscribed, permission: data.permission || 'default' })
      else reject(new Error(data.reason || 'Push status failed'))
    }
    window.addEventListener('message', onMessage)
    window.parent.postMessage({ type: 'push-status', id }, '*')
  })
}

function shellPushUnsubscribe(): Promise<void> {
  const id = ++shellPushIdCounter
  return new Promise((resolve, reject) => {
    function onMessage(event: MessageEvent) {
      if (event.source !== window.parent) return
      const data = event.data
      if (!data || data.type !== 'push-unsubscribe-result' || data.id !== id) return
      window.removeEventListener('message', onMessage)
      if (data.ok) resolve()
      else reject(new Error(data.reason || 'Push unsubscribe failed'))
    }
    window.addEventListener('message', onMessage)
    window.parent.postMessage({ type: 'push-unsubscribe', id }, '*')
  })
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
