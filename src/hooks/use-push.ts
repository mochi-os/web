import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { requestHelpers } from '../lib/request'
import { handlePermissionError } from '../lib/permission-utils'
import * as push from '../lib/push'
import { getBrowserName } from '../lib/push'
import { NOTIFICATIONS_PATH } from '../lib/app-path'
import { isInShell } from '../lib/shell-bridge'

// All push API calls go to notifications app
const NOTIFICATIONS_APP = 'notifications'

// Check if error is a permission error and handle it
function checkPermissionError(error: unknown): void {
  if (error && typeof error === 'object' && 'data' in error) {
    // ApiError structure: error.data contains the response data
    const apiError = error as { data?: unknown }
    if (apiError.data) {
      handlePermissionError(apiError.data, NOTIFICATIONS_APP)
    }
  }
}

interface VapidKeyResponse {
  data: {
    key: string
  }
}

interface Account {
  id: number
  type: string
  identifier: string
  verified: number
}

interface AccountsListResponse {
  data: Account[]
}

interface PushState {
  supported: boolean
  supportChecked: boolean
  permission: NotificationPermission
  subscribed: boolean
}

/**
 * Request push registration via the shell (postMessage to parent).
 * The menu app in the shell handles the service worker, VAPID, and account creation.
 */
let shellPushIdCounter = 0

function shellPushSubscribe(): Promise<void> {
  const id = ++shellPushIdCounter
  return new Promise((resolve, reject) => {
    function onMessage(event: MessageEvent) {
      const data = event.data
      if (!data || data.type !== 'push-result' || data.id !== id) return
      window.removeEventListener('message', onMessage)
      if (data.ok) {
        resolve()
      } else {
        reject(new Error(data.reason || 'Push registration failed'))
      }
    }
    window.addEventListener('message', onMessage)
    window.parent.postMessage({ type: 'push-subscribe', id }, '*')
  })
}

export function usePush() {
  const queryClient = useQueryClient()
  const inShell = isInShell()

  const [state, setState] = useState<PushState>({
    // In the shell, push is always supported (the shell page handles registration).
    // The SubscribeDialog uses the destinations API to check if a browser account
    // already exists — this flag only controls whether to show the "enable push" option.
    supported: inShell,
    supportChecked: inShell,
    permission: push.getPermission(),
    subscribed: false,
  })

  // Fetch VAPID key from accounts endpoint (only outside shell — direct mode)
  const { data: vapidKey } = useQuery({
    queryKey: ['accounts', 'vapid'],
    queryFn: async () => {
      const res = await requestHelpers.getRaw<VapidKeyResponse>(
        `${NOTIFICATIONS_PATH}/-/accounts/vapid`
      )
      return res?.data?.key || ''
    },
    staleTime: Infinity,
    enabled: !inShell,
  })

  // Check if browser is subscribed (only outside shell — direct mode)
  useEffect(() => {
    if (inShell) return
    push.isSupported().then((supported) => {
      setState((s) => ({ ...s, supported, supportChecked: true }))
      if (supported && push.getPermission() === 'granted') {
        navigator.serviceWorker.ready.then((reg) =>
          reg.pushManager
            .getSubscription()
            .then((sub) => setState((s) => ({ ...s, subscribed: !!sub })))
        )
      }
    })
  }, [inShell])

  const subscribeMutation = useMutation({
    mutationFn: async () => {
      if (inShell) {
        // Proxy through the shell — the menu app handles the actual registration
        await shellPushSubscribe()
        return
      }

      // Direct mode (not in shell)
      if (!vapidKey) throw new Error('No VAPID key')
      const permission = await push.requestPermission()
      if (permission !== 'granted') throw new Error('Permission denied')
      const subscription = await push.subscribe(vapidKey)
      if (!subscription) throw new Error('Subscription failed')

      const subData = push.getSubscriptionData(subscription)
      const formData = new URLSearchParams()
      formData.append('type', 'browser')
      formData.append('endpoint', subData.endpoint)
      formData.append('auth', subData.auth)
      formData.append('p256dh', subData.p256dh)
      formData.append('label', getBrowserName())

      try {
        await requestHelpers.post(
          `${NOTIFICATIONS_PATH}/-/accounts/add`,
          formData.toString(),
          {
            headers: {
              'Content-Type': 'application/x-www-form-urlencoded',
            },
          }
        )
      } catch (error) {
        checkPermissionError(error)
        throw error
      }
    },
    onSuccess: () => {
      setState((s) => ({ ...s, permission: 'granted', subscribed: true }))
      queryClient.invalidateQueries({ queryKey: ['accounts', 'list'] })
    },
    onError: (error) => {
      console.error('Push subscribe error:', error)
    },
  })

  const unsubscribeMutation = useMutation({
    mutationFn: async () => {
      if (inShell) {
        // In shell mode, push is managed at the shell level.
        // Unsubscription should be done from the notifications settings.
        return
      }

      const reg = await navigator.serviceWorker.ready
      const sub = await reg.pushManager.getSubscription()
      if (sub) {
        try {
          // Find the account by endpoint (stored as identifier for browser accounts)
          const res = await requestHelpers.getRaw<AccountsListResponse>(
            `${NOTIFICATIONS_PATH}/-/accounts/list?capability=notify`
          )
          const accounts = res?.data || []
          const account = accounts.find(
            (a) => a.type === 'browser' && a.identifier === sub.endpoint
          )

          if (account) {
            const formData = new URLSearchParams()
            formData.append('id', String(account.id))

            await requestHelpers.post(
              `${NOTIFICATIONS_PATH}/-/accounts/remove`,
              formData.toString(),
              {
                headers: {
                  'Content-Type': 'application/x-www-form-urlencoded',
                },
              }
            )
          }
        } catch (error) {
          checkPermissionError(error)
          throw error
        }

        await sub.unsubscribe()
      }
    },
    onSuccess: () => {
      setState((s) => ({ ...s, subscribed: false }))
      queryClient.invalidateQueries({ queryKey: ['accounts', 'list'] })
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
