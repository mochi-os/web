// Copyright © 2026 Mochi OÜ
// SPDX-License-Identifier: Apache-2.0

import { type LinkProps } from '@tanstack/react-router'

type BaseNavItem = {
  title: string
  badge?: string
  icon?: React.ElementType
  variant?: 'default' | 'outline' | 'primary'
  className?: string
  /**
   * Marks an aggregate ("All <items>") entry. It reuses the same `icon` as the
   * individual items it represents, with a small hollow ring drawn at the
   * icon's corner so it stays distinct — including in icon-collapsed mode,
   * where the text label is hidden. See the "All X" sidebar convention.
   */
  aggregate?: boolean
}

type NavMenuItem = {
  title: string
  icon?: React.ElementType
  onClick: () => void
  disabled?: boolean
  destructive?: boolean
}

type NavLink = BaseNavItem & {
  url: LinkProps['to'] | (string & {})
  items?: never
  external?: boolean // For cross-app navigation
  isActive?: boolean // Override active state for external links
  onClick?: never
  menu?: NavMenuItem[]
  /** Trailing icon shown before the unread badge (e.g. pinned chat indicator). */
  endIcon?: React.ElementType
  endIconClassName?: string
}

type NavAction = BaseNavItem & {
  onClick: () => void
  url?: never
  items?: never
  external?: never
  isActive?: boolean
}

// Sub-item that can be a link, action, or nested collapsible
type NavSubItem = (BaseNavItem & {
  url: LinkProps['to'] | (string & {})
  external?: boolean
  items?: never
}) | NavAction | NavSubCollapsible

// Nested collapsible for sub-menus (supports one additional level)
type NavSubCollapsible = BaseNavItem & {
  items: (BaseNavItem & {
    url: LinkProps['to'] | (string & {})
    external?: boolean
  } | NavAction)[]
  url?: LinkProps['to'] | (string & {})
  external?: boolean
  open?: boolean
}

type NavCollapsible = BaseNavItem & {
  items: NavSubItem[]
  url?: LinkProps['to'] | (string & {}) // Optional URL makes the header clickable
  external?: boolean
  open?: boolean // Controlled open state - when provided, only this item is expanded
}

type NavItem = NavCollapsible | NavLink | NavAction

type NavGroup = {
  title: string
  items: NavItem[]
  separator?: boolean // Show a separator line above this group
}

type SidebarData = {
  navGroups: NavGroup[]
}

export type { SidebarData, NavGroup, NavItem, NavCollapsible, NavSubCollapsible, NavSubItem, NavLink, NavAction, NavMenuItem }
