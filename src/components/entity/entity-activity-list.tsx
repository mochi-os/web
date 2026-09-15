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
import { EmptyState } from '../ui/empty-state'
import { EntityAvatar } from '../entity-avatar'
import { ListSkeleton } from '../ui/list-skeleton'
import { LoadMoreTrigger } from '../load-more-trigger'
import { useFormat } from '../../hooks/use-format'
import { getAppPath } from '../../lib/app-path'
import type { EntityActivity, EntityField } from '../../types/entity-object'

// The server's default page. A shorter page is the last one.
const ACTIVITY_PAGE_SIZE = 100

export interface EntityActivityListProps {
  containerId: string
  objectId: string
  listActivity: (
    containerId: string,
    objectId: string,
    page?: { limit: number; offset: number },
  ) => Promise<{ data: { activities: EntityActivity[] } }>
  /** The object's class fields, which name the field an entry changed. */
  fields?: EntityField[]
}

export function EntityActivityList({
  containerId,
  objectId,
  listActivity,
  fields,
}: EntityActivityListProps) {
  const { t } = useLingui()
  const { formatTimestamp } = useFormat()
  const {
    data,
    isLoading,
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
    switch (activity.action) {
      case 'create':
        return field ? t`Created ${field}` : t`Created`
      case 'update':
        return field ? t`Updated ${field}` : t`Updated`
      case 'delete':
        return field ? t`Deleted ${field}` : t`Deleted`
      case 'move':
        return field ? t`Moved ${field}` : t`Moved`
      default:
        return field ? t`Changed ${field}` : t`Changed`
    }
  }

  if (isLoading) {
    return <ListSkeleton count={3} variant='simple' height='h-10' />
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
              {activity.oldvalue && activity.newvalue && (
                <>
                  {': '}
                  <span className='line-through font-normal text-muted-foreground'>
                    {activity.oldvalue}
                  </span>
                  {' → '}
                  <span>{activity.newvalue}</span>
                </>
              )}
            </p>
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
