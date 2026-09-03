// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: Apache-2.0

import { type LinkProps } from '@tanstack/react-router'

type BaseNavItem = {
  /** Stable React key for list items; avoids remount when title/badge changes. */
  id?: string
  title: string
  badge?: string
  /** Muted inline label after the title (e.g. chat Draft). */
  meta?: string
  icon?: React.ElementType
  variant?: 'default' | 'outline' | 'primary'
  className?: string
  /**
   * Marks an aggregate ("All <items>") entry: same `icon` as its members, with
   * a hollow ring at the corner that stays visible in icon-collapsed mode.
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
  /** Show title tooltip even when the sidebar is expanded (truncated labels). */
  tooltipAlways?: boolean
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
  /** Stable key when several groups share a title, or have none. */
  id?: string
  title: string
  items: NavItem[]
  separator?: boolean // Show a separator line above this group
  /** Animate insert/remove on direct SidebarMenu children (entity lists). */
  animateList?: boolean
}

type SidebarData = {
  navGroups: NavGroup[]
}

export type { SidebarData, NavGroup, NavItem, NavCollapsible, NavSubCollapsible, NavSubItem, NavLink, NavAction, NavMenuItem }
