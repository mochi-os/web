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

export interface SubscribeButtonProps {
  app: string
  label?: string
  type?: string
  object?: string
  subscriptions?: SubscriptionItem[]
  onResult?: (subscriptionIds: number | number[] | null) => void
  appBase?: string
  children?: React.ReactNode
  variant?: 'default' | 'destructive' | 'outline' | 'secondary' | 'ghost' | 'link'
  size?: 'default' | 'sm' | 'lg' | 'icon'
  disabled?: boolean
  className?: string
}

export interface SubscriptionItem {
  label: string
  type: string
  object?: string
  defaultEnabled?: boolean
}

export interface SubscribeDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  app: string
  /** Single subscription label (legacy) */
  label?: string
  /** Single subscription type (legacy) */
  type?: string
  /** Single subscription object (legacy) */
  object?: string
  /** Multiple subscriptions to offer */
  subscriptions?: SubscriptionItem[]
  appBase?: string
  onResult?: (subscriptionIds: number | number[] | null) => void
}

export interface DestinationToggle {
  type: 'account' | 'rss'
  accountType?: string  // 'browser', 'email', 'url' for accounts
  id: number | string
  label: string
  identifier?: string
  enabled: boolean
}
