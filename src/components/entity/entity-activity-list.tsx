// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: Apache-2.0

// Activity timeline for one object in the object/class/field apps (crm,
// projects). The fetch arrives as a prop rather than an imported API module,
// because the module is per-app even though the route behind it is not.

import { useQuery } from '@tanstack/react-query'
import { t } from '@lingui/core/macro'
import { Activity } from 'lucide-react'
import { ActivityTimeline } from '../activity-timeline'
import { EmptyState } from '../ui/empty-state'
import { EntityAvatar } from '../entity-avatar'
import { ListSkeleton } from '../ui/list-skeleton'
import { useFormat } from '../../hooks/use-format'
import { getAppPath } from '../../lib/app-path'
import type { EntityActivity } from '../../types/entity-object'

export interface EntityActivityListProps {
  containerId: string
  objectId: string
  listActivity: (
    containerId: string,
    objectId: string,
  ) => Promise<{ data: { activities: EntityActivity[] } }>
}

export function EntityActivityList({
  containerId,
  objectId,
  listActivity,
}: EntityActivityListProps) {
  const { formatTimestamp } = useFormat()
  const { data, isLoading } = useQuery({
    queryKey: ['activity', containerId, objectId],
    queryFn: async () => {
      const response = await listActivity(containerId, objectId)
      return response.data.activities
    },
  })

  const formatAction = (action: string) => {
    switch (action) {
      case 'create':
        return 'created'
      case 'update':
        return 'updated'
      case 'delete':
        return 'deleted'
      case 'move':
        return 'moved'
      default:
        return action
    }
  }

  if (isLoading) {
    return <ListSkeleton count={3} variant="simple" height="h-10" />
  }

  const activities = data || []

  if (activities.length === 0) {
    return (
      <EmptyState icon={Activity} title={t`No activity yet`} className="py-4" />
    )
  }

  return (
    <ActivityTimeline
      items={activities.map((activity) => ({
        id: activity.id,
        primary: (
          <p className="text-sm font-medium">
            {formatAction(activity.action)}
            {activity.field && ` ${activity.field}`}
            {activity.oldvalue && activity.newvalue && (
              <>
                {': '}
                <span className="line-through font-normal text-muted-foreground">
                  {activity.oldvalue}
                </span>
                {' → '}
                <span>{activity.newvalue}</span>
              </>
            )}
          </p>
        ),
        secondary: (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <EntityAvatar
              src={`${getAppPath()}/${containerId}/-/activity/${activity.id}/asset/avatar`}
              styleUrl={`${getAppPath()}/${containerId}/-/activity/${activity.id}/asset/style`}
              seed={activity.user}
              name={activity.name || activity.user}
              size="xs"
            />
            <span>{activity.name || activity.user}</span>
            <span>·</span>
            <span>{formatTimestamp(activity.created)}</span>
          </div>
        ),
      }))}
    />
  )
}
