// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: Apache-2.0

// Types for notification subscriptions

export interface SubscriptionDestination {
  type: 'account' | 'rss'
  target: string
}

export interface Subscription {
  id: number
  app: string
  type: string
  object: string
  label: string
  created: number
  destinations: SubscriptionDestination[]
}
