// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: Apache-2.0

// Activity timeline for one object in the object/class/field apps (crm,
// projects). The fetch arrives as a prop rather than an imported API module,
// because the module is per-app even though the route behind it is not.

import { useCallback, useMemo } from 'react'
import { useInfiniteQuery } from '@tanstack/react-query'
import { useLingui } from '@lingui/react/macro'
import { Activity } from 'lucide-react'
import { ActivityTimeline } from '../activity-timeline'
import { GeneralError } from '../../features/errors/general-error'
import { EmptyState } from '../ui/empty-state'
import { EntityAvatar } from '../entity-avatar'
import { ListSkeleton } from '../ui/list-skeleton'
import { LoadMoreTrigger } from '../load-more-trigger'
import { useFormat } from '../../hooks/use-format'
import { getAppPath } from '../../lib/app-path'
import { entityDisplayValue } from '../../lib/entity-display'
import type {
  EntityActivity,
  EntityClass,
  EntityField,
  EntityFieldOption,
} from '../../types/entity-object'
import { useLinkTypeLabels } from './entity-object-links'

// The server's default page. A shorter page is the last one.
const ACTIVITY_PAGE_SIZE = 100

export interface EntityActivityListProps {
  containerId: string
  objectId: string
  listActivity: (
    containerId: string,
    objectId: string,
    page?: { limit: number; offset: number }
  ) => Promise<{ data: { activities: EntityActivity[] } }>
  /** The object's class fields, which name the field an entry changed. */
  fields?: EntityField[]
  /** The class's options by field id, so a select change shows option names. */
  options?: Record<string, EntityFieldOption[]>
  /** User id to name, so a person change shows names. */
  people?: Record<string, string>
  /** Object id to title, for parent moves and links. */
  objectTitle?: (id: string) => string | undefined
  /** The design's classes, for a change of class. */
  classes?: EntityClass[]
  /** Wording for entries with no field to name. Each app passes its own. */
  labels?: EntityActivityListLabels
}

export interface EntityActivityListLabels {
  commented?: string
  attached?: string
}

// The server logs past tense (`created`, `updated`, `moved`); the present-tense
// names are what this list was first written against, and tests still use them.
const ACTION_ALIASES: Record<string, string> = {
  create: 'created',
  update: 'updated',
  delete: 'deleted',
  move: 'moved',
}

export function EntityActivityList({
  containerId,
  objectId,
  listActivity,
  fields,
  options,
  people,
  objectTitle,
  classes,
  labels,
}: EntityActivityListProps) {
  const { t } = useLingui()
  const { formatTimestamp, formatDate, formatNumber } = useFormat()
  const linkTypeLabels = useLinkTypeLabels()
  const {
    data,
    isLoading,
    isError,
    error,
    refetch,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isFetchNextPageError,
  } = useInfiniteQuery({
    queryKey: ['activity', containerId, objectId],
    queryFn: async ({ pageParam }) => {
      const response = await listActivity(containerId, objectId, {
        limit: ACTIVITY_PAGE_SIZE,
        offset: pageParam,
      })
      return response.data.activities ?? []
    },
    initialPageParam: 0,
    // The offset counts what was asked for, not what the list kept after
    // dropping repeats, so it always lands on the server's next page.
    getNextPageParam: (lastPage, allPages) =>
      lastPage.length < ACTIVITY_PAGE_SIZE
        ? undefined
        : allPages.length * ACTIVITY_PAGE_SIZE,
  })
  // Offset paging: an edit between two page loads adds an entry at the top
  // and pushes the rest down, so the next page can repeat entries already
  // shown. Keep the first of each id.
  const activities = useMemo(() => {
    const seen = new Set<EntityActivity['id']>()
    return (data?.pages ?? []).flat().filter((activity) => {
      if (seen.has(activity.id)) return false
      seen.add(activity.id)
      return true
    })
  }, [data])
  const loadMore = useCallback(() => {
    void fetchNextPage()
  }, [fetchNextPage])

  // A field the design no longer has is left unnamed rather than shown as
  // its id.
  const describe = (activity: EntityActivity) => {
    const field = activity.field
      ? fields?.find((f) => f.id === activity.field)?.name
      : undefined
    const action = ACTION_ALIASES[activity.action] ?? activity.action
    // Wording for entries that name no field. Without it they fall through to
    // "Changed". Kept out of the switch so "Changed" stays one message call:
    // each extra call adds an origin line to every app's catalogs.
    const named =
      action === 'linked'
        ? linkTypeLabels[activity.field]
        : action === 'commented'
          ? labels?.commented
          : action === 'attached'
            ? labels?.attached
            : undefined
    if (named) return named
    switch (action) {
      case 'created':
        return field ? t`Created ${field}` : t`Created`
      case 'updated':
        return field ? t`Updated ${field}` : t`Updated`
      case 'deleted':
        return field ? t`Deleted ${field}` : t`Deleted`
      case 'moved':
        return field ? t`Moved ${field}` : t`Moved`
      default:
        return field ? t`Changed ${field}` : t`Changed`
    }
  }

  // The stored values are ids for selects, people, items and classes. Show
  // what the screen shows for them. An item that no longer exists has no
  // title to show, so it reads as empty rather than as its id.
  const shown = (activity: EntityActivity, raw: string) => {
    if (!raw) return ''
    const action = ACTION_ALIASES[activity.action] ?? activity.action
    if (
      (action === 'moved' && activity.field === 'parent') ||
      action === 'linked'
    ) {
      return objectTitle?.(raw) ?? '—'
    }
    if (activity.field === 'class' && action === 'updated') {
      return classes?.find((c) => c.id === raw)?.name ?? raw
    }
    const field = fields?.find((f) => f.id === activity.field)
    return entityDisplayValue(field, raw, {
      options: options?.[activity.field],
      people,
      objectTitle,
      formatDate,
      formatNumber,
    })
  }

  if (isLoading) {
    return <ListSkeleton count={3} variant='simple' height='h-10' />
  }

  // A failed first load is not an empty history.
  if (isError && activities.length === 0) {
    return (
      <GeneralError
        error={error}
        minimal
        mode='inline'
        reset={() => {
          void refetch()
        }}
      />
    )
  }

  if (activities.length === 0) {
    return (
      <EmptyState icon={Activity} title={t`No activity yet`} className='py-4' />
    )
  }

  return (
    <>
      <ActivityTimeline
        items={activities.map((activity) => ({
          id: activity.id,
          primary: (
            <ActivityChange
              label={describe(activity)}
              from={shown(activity, activity.oldvalue)}
              to={shown(activity, activity.newvalue)}
            />
          ),
          secondary: (
            <div className='flex items-center gap-2 text-xs text-muted-foreground'>
              <EntityAvatar
                src={`${getAppPath()}/${containerId}/-/activity/${activity.id}/asset/avatar`}
                styleUrl={`${getAppPath()}/${containerId}/-/activity/${activity.id}/asset/style`}
                seed={activity.user}
                name={activity.name || activity.user}
                size='xs'
              />
              <span>{activity.name || activity.user}</span>
              <span>·</span>
              <span>{formatTimestamp(activity.created)}</span>
            </div>
          ),
        }))}
      />
      {/* Stops after a failed page: the observer re-arms whenever loading
          ends, so leaving it live would retry the failing request in a loop. */}
      <LoadMoreTrigger
        onLoadMore={loadMore}
        hasMore={!!hasNextPage && !isFetchNextPageError}
        isLoading={isFetchingNextPage}
      />
    </>
  )
}

// "Stage: Lead → Qualified". A value set from nothing shows only the new one,
// and a cleared value shows only the old one, struck through.
function ActivityChange({
  label,
  from,
  to,
}: {
  label: string
  from: string
  to: string
}) {
  return (
    <p className='text-sm font-medium'>
      {label}
      {(from || to) && ': '}
      {from && (
        <span className='line-through font-normal text-muted-foreground'>
          {from}
        </span>
      )}
      {from && to && ' → '}
      {to && <span>{to}</span>}
    </p>
  )
}
