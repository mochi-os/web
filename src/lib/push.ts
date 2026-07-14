// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: Apache-2.0

// Push notification utilities

const SW_PATH = '/sw.js'

export async function isSupported(): Promise<boolean> {
  return 'serviceWorker' in navigator && 'PushManager' in window
}

export function getPermission(): NotificationPermission {
  return 'Notification' in window ? Notification.permission : 'denied'
}

export async function requestPermission(): Promise<NotificationPermission> {
  if (!('Notification' in window)) return 'denied'
  return Notification.requestPermission()
}

export async function subscribe(
  vapidPublicKey: string
): Promise<PushSubscription | null> {
  if (!(await isSupported())) return null

  try {
    const registration = await navigator.serviceWorker.register(SW_PATH)
    await navigator.serviceWorker.ready

    let subscription = await registration.pushManager.getSubscription()
    if (!subscription) {
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
      })
    }
    return subscription
  } catch {
    return null
  }
}

export async function unsubscribe(): Promise<boolean> {
  try {
    const registration = await navigator.serviceWorker.ready
    const subscription = await registration.pushManager.getSubscription()
    if (subscription) return subscription.unsubscribe()
    return true
  } catch {
    return false
  }
}

export function getSubscriptionData(sub: PushSubscription) {
  const json = sub.toJSON()
  return {
    endpoint: sub.endpoint,
    auth: json.keys?.auth || '',
    p256dh: json.keys?.p256dh || '',
  }
}

// Detect browser name from user agent
export function getBrowserName(): string {
  const ua = navigator.userAgent
  if (ua.includes('Firefox')) return 'Firefox'
  if (ua.includes('Edg/')) return 'Edge'
  if (ua.includes('Chrome')) return 'Chrome'
  if (ua.includes('Safari')) return 'Safari'
  if (ua.includes('Opera') || ua.includes('OPR')) return 'Opera'
  return 'Browser'
}

function urlBase64ToUint8Array(base64: string): ArrayBuffer {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4)
  const b64 = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(b64)
  const arr = new Uint8Array(raw.length)
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i)
  return arr.buffer
}
