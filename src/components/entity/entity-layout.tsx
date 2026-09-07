// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: Apache-2.0

// The app shell shared by crm and projects. The sidebar provider and the create
// dialog stay app-side, the dialog arriving as `children`. Every string arrives
// resolved from the app, for the reason given in entity-list-page.tsx.

import { useEffect, useMemo, type ReactNode } from 'react'
import { Plus, RefreshCw, Search, type LucideIcon } from 'lucide-react'
import { AuthenticatedLayout } from '../layout/authenticated-layout'
import type { NavItem, SidebarData } from '../layout/types'
import { naturalCompare } from '../../lib/utils'
import type { EntityListRow } from './entity-list-page'

export interface EntityLayoutLabels {
  /** Heading over the container list, and the aggregate entry's group. */
  group: string
  /** The "All <containers>" aggregate entry. */
  all: string
  find: string
  create: string
  /** Shown in place of the list when the load failed. */
  retry: string
}

interface EntityLayoutProps<Row extends EntityListRow> {
  rows: Row[]
  isLoading: boolean
  error?: string | null
  refresh: () => void | Promise<unknown>
  icon: LucideIcon
  labels: EntityLayoutLabels
  onCreate: () => void
  /** The app's own route for one container. */
  viewUrl: (id: string) => string
  /** The app's create dialog, rendered beside the shell. */
  children?: ReactNode
}

export function EntityLayout<Row extends EntityListRow>({
  rows,
  isLoading,
  error,
  refresh,
  icon,
  labels,
  onCreate,
  viewUrl,
  children,
}: EntityLayoutProps<Row>) {
  useEffect(() => {
    void refresh()
  }, [refresh])

  // Destructured so the memo depends on the individual strings rather than the
  // labels object, which an app builds inline and would rebuild every render.
  const { group, all, find, create, retry } = labels

  const sidebarData: SidebarData = useMemo(() => {
    const sorted = [...rows].sort((a, b) => naturalCompare(a.name, b.name))

    const rowItems: NavItem[] = sorted.map((row) => ({
      title: row.name,
      // `||`, not `??`: fingerprint is a required string, so a container
      // without one carries "" rather than null, and `??` would hand viewUrl an
      // empty id and link the entry to the list root. Both apps' own layouts
      // had the same `??` before this moved here.
      url: viewUrl(row.fingerprint || row.id),
      icon,
    }))

    const allItem: NavItem = {
      title: all,
      url: '/',
      icon,
      aggregate: true,
    }

    const actionItems: NavItem[] = [
      { title: find, icon: Search, url: '/find' },
      { title: create, icon: Plus, onClick: onCreate },
    ]

    const groups: SidebarData['navGroups'] = [
      {
        title: group,
        items: [
          allItem,
          ...rowItems,
          ...(error
            ? [
                {
                  title: retry,
                  icon: RefreshCw,
                  onClick: () => {
                    void refresh()
                  },
                  className: 'text-destructive',
                },
              ]
            : []),
        ],
      },
      {
        title: '',
        items: actionItems,
        separator: true,
      },
    ]

    return { navGroups: groups }
  }, [rows, onCreate, error, refresh, icon, viewUrl, group, all, find, create, retry])

  return (
    <>
      <AuthenticatedLayout
        sidebarData={sidebarData}
        isLoadingSidebar={isLoading && rows.length === 0}
      />
      {children}
    </>
  )
}
