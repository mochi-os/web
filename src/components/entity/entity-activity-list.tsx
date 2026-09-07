// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: Apache-2.0

// Activity timeline for one object in the object/class/field apps (crm,
// projects). The fetch arrives as a prop rather than an imported API module,
// because the module is per-app even though the route behind it is not.

import { useQuery } from '@tanstack/react-query'
import { useLingui } from '@lingui/react/macro'
import { Activity } from 'lucide-react'
import { ActivityTimeline } from '../activity-timeline'
import { EmptyState } from '../ui/empty-state'
import { EntityAvatar } from '../entity-avatar'
import { ListSkeleton } from '../ui/list-skeleton'
import { useFormat } from '../../hooks/use-format'
import { getAppPath } from '../../lib/app-path'
import type { EntityActivity, EntityField } from '../../types/entity-object'

export interface EntityActivityListProps {
  containerId: string
  objectId: string
  listActivity: (
    containerId: string,
    objectId: string,
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
  const { data, isLoading } = useQuery({
    queryKey: ['activity', containerId, objectId],
    queryFn: async () => {
      const response = await listActivity(containerId, objectId)
      return response.data.activities
    },
  })

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
            {describe(activity)}
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
