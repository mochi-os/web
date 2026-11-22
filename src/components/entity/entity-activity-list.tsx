// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: Apache-2.0

// Activity timeline for one object in the object/class/field apps (crm,
// projects). The fetch arrives as a prop rather than an imported API module,
// because the module is per-app even though the route behind it is not.

import { useCallback, useMemo, type ReactNode } from 'react'
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
import { decimalPlaces } from '../../lib/locale-format'
import { entityAddress, entityAssets } from '../../lib/entity-endpoints'
import { addressByAuthor } from '../../lib/comment-tree'
import { checklistItems } from './checklist'
import type { EntityActivity, EntityField } from '../../types/entity-object'

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
}

// The server logs past tense (`created`, `updated`, `moved`). The
// present-tense names are what this list was first written against.
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
}: EntityActivityListProps) {
  const { t } = useLingui()
  const { formatTimestamp, formatDate, formatNumber } = useFormat()
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

  // One avatar address per person across the list: the route names an
  // activity row, and any row on the item answers with its person's picture.
  const avatars = useMemo(
    () =>
      addressByAuthor(activities, {
        getAuthor: (activity) => activity.user,
        getAddress: (activity) =>
          entityAddress(() => entityAssets.activity(containerId, activity.id)),
      }),
    [activities, containerId]
  )
  const asset = (activity: EntityActivity, slot: 'avatar' | 'style') => {
    const address =
      avatars.get(activity.user) ??
      entityAddress(() => entityAssets.activity(containerId, activity.id))
    return address && `${address}/${slot}`
  }

  const loadMore = useCallback(() => {
    void fetchNextPage()
  }, [fetchNextPage])

  const linkTypes: Record<string, string> = {
    relates: t`Relates`,
    blocks: t`Blocks`,
    duplicates: t`Duplicates`,
    'blocked by': t`Blocked by`,
  }

  // The field an entry changed, by the name the server gave it or else the
  // design's; a field the design no longer has is left unnamed rather than
  // shown as its id.
  const definition = (activity: EntityActivity) => {
    const field = activity.field
      ? fields?.find((f) => f.id === activity.field)
      : undefined
    return {
      name: activity.display?.field ?? field?.name,
      type: activity.display?.type ?? field?.fieldtype,
    }
  }

  // A class change is logged as an update of "class", which names no field of
  // the class; the server then names the classes themselves.
  const classChange = (activity: EntityActivity) =>
    (ACTION_ALIASES[activity.action] ?? activity.action) === 'updated' &&
    activity.field === 'class' &&
    !definition(activity).name

  const describe = (activity: EntityActivity) => {
    const field = definition(activity).name
    if (classChange(activity)) return t`Changed class`
    switch (ACTION_ALIASES[activity.action] ?? activity.action) {
      case 'created':
        return field ? t`Created ${field}` : t`Created`
      case 'updated':
        return field ? t`Updated ${field}` : t`Updated`
      case 'deleted':
        return field ? t`Deleted ${field}` : t`Deleted`
      case 'moved':
        return t`Moved`
      case 'linked':
        return linkTypes[activity.field] ?? t`Links`
      default:
        return field ? t`Changed ${field}` : t`Changed`
    }
  }

  // One side of a change as a reader should see it: what the server named,
  // or the stored value formatted by its field's type. A value naming an
  // object, a class or a person is never shown as its id.
  const side = (
    activity: EntityActivity,
    stored: string,
    named: string | undefined
  ): ReactNode => {
    if (named) return named
    const action = ACTION_ALIASES[activity.action] ?? activity.action
    if (action === 'moved') {
      if (!activity.oldvalue && !activity.newvalue) return null
      return stored ? t`Unknown` : t`Top level`
    }
    if (action === 'linked' || classChange(activity)) {
      return stored ? t`Unknown` : null
    }
    if (!stored) return null
    switch (definition(activity).type) {
      case 'date':
        return formatDate(new Date(stored + 'T00:00:00'))
      case 'number': {
        const numeric = Number(stored)
        return Number.isFinite(numeric)
          ? formatNumber(numeric, decimalPlaces(stored))
          : stored
      }
      case 'checkbox':
        return stored === '1' || stored === 'true' ? t`Yes` : t`No`
      case 'checklist': {
        const items = checklistItems(stored)
        return `${formatNumber(items.filter((item) => item.done).length)}/${formatNumber(items.length)}`
      }
      case 'user':
      case 'object':
        return t`Unknown`
      default:
        return stored
    }
  }

  const change = (activity: EntityActivity) => {
    const before = side(activity, activity.oldvalue, activity.display?.old)
    const after = side(activity, activity.newvalue, activity.display?.new)
    if (before === null && after === null) return null
    return (
      <>
        {': '}
        {before !== null && (
          <>
            <span className='line-through font-normal text-muted-foreground'>
              {before}
            </span>
            {' → '}
          </>
        )}
        <span>{after ?? '—'}</span>
      </>
    )
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
            <p className='text-sm font-medium'>
              {describe(activity)}
              {change(activity)}
            </p>
          ),
          secondary: (
            <div className='flex items-center gap-2 text-xs text-muted-foreground'>
              <EntityAvatar
                src={asset(activity, 'avatar')}
                styleUrl={asset(activity, 'style')}
                seed={activity.user}
                name={activity.name || undefined}
                size='xs'
              />
              <span>{activity.name || t`Unknown`}</span>
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
