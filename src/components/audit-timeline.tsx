// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: Apache-2.0

import { useEffect, useRef, useState } from 'react'
import { useLingui } from '@lingui/react/macro'
import { ActivityTimeline } from './activity-timeline'
import { Card, CardContent } from './ui/card'
import { useFormat } from '../hooks/use-format'
import { getErrorMessage } from '../lib/handle-server-error'

/** The audit fields the timeline renders. App entry types carry more. */
export interface AuditTimelineEntry {
  id: string
  action: string
  data: string
  actor: string
  actor_name: string
  timestamp: number
}

interface AuditTimelineProps {
  kind: string
  object: string | number
  /**
   * Loads one object's audit trail. Held in a ref, so passing an inline
   * arrow does not refetch on every render.
   */
  fetchAudit: (params: {
    kind: string
    object: string
    limit: number
  }) => Promise<{ audit: AuditTimelineEntry[] }>
  /** Localised label per action key; unknown keys fall back to the key. */
  actionLabels: Record<string, string>
  /** Localised detail line built from the entry's parsed data. */
  formatDetail?: (
    data: Record<string, unknown> | null,
    action: string
  ) => string | null
  /** Renders an actor id when the entry carries no actor name. */
  formatFingerprint: (actor: string) => string
  title?: string
}

/**
 * An object's audit trail, in a card. Renders nothing while loading, when
 * the trail is empty, and when the fetch fails — history is supplementary,
 * so it never takes space it cannot fill.
 *
 * The audit vocabulary is app domain, not platform: the caller supplies the
 * action labels and the detail formatter.
 */
export function AuditTimeline({
  kind,
  object,
  fetchAudit,
  actionLabels,
  formatDetail,
  formatFingerprint,
  title,
}: AuditTimelineProps) {
  const { t } = useLingui()
  const { formatTimestamp } = useFormat()
  const resolvedTitle = title ?? t`History`
  const [entries, setEntries] = useState<AuditTimelineEntry[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  const fetchRef = useRef(fetchAudit)
  useEffect(() => {
    fetchRef.current = fetchAudit
  })

  useEffect(() => {
    let cancelled = false
    fetchRef
      .current({ kind, object: String(object), limit: 100 })
      .then((r) => {
        if (!cancelled) setEntries(r.audit)
      })
      .catch((err) => {
        if (!cancelled) setError(getErrorMessage(err, t`Failed to load history`))
      })
    return () => {
      cancelled = true
    }
  }, [kind, object, t])

  if (error) return null
  if (!entries || entries.length === 0) return null

  return (
    <Card className='rounded-lg'>
      <CardContent className='p-5'>
        <h3 className='mb-4 font-semibold'>{resolvedTitle}</h3>
        <ActivityTimeline
          items={entries.map((entry) => {
            const label = actionLabels[entry.action] ?? entry.action
            const detail = formatDetail?.(parseData(entry.data), entry.action)
            const actor =
              entry.actor === 'system'
                ? t`System`
                : entry.actor_name || formatFingerprint(entry.actor)
            return {
              id: entry.id,
              primary: (
                <p className='text-sm'>
                  <span className='font-medium'>{label}</span>
                  {detail && (
                    <span className='text-muted-foreground'>: {detail}</span>
                  )}
                </p>
              ),
              secondary: (
                <p className='text-muted-foreground text-xs'>
                  {formatTimestamp(entry.timestamp)} · {actor}
                </p>
              ),
            }
          })}
        />
      </CardContent>
    </Card>
  )
}

function parseData(raw: string): Record<string, unknown> | null {
  if (!raw) return null
  try {
    return JSON.parse(raw) as Record<string, unknown>
  } catch {
    return null
  }
}
