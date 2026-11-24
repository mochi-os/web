// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: Apache-2.0

import { useEffect, useRef, useState } from 'react'
import { useLingui } from '@lingui/react/macro'
import { ActivityTimeline } from './activity-timeline'
import { Card, CardContent } from './ui/card'
import { LoadMore } from './ui/load-more'
import { useFormat } from '../hooks/use-format'
import { getErrorMessage } from '../lib/handle-server-error'
import { toast } from '../lib/toast-utils'

/** The audit fields the timeline renders. App entry types carry more. */
export interface AuditTimelineEntry {
  id: string
  action: string
  data: string
  actor: string
  actor_name: string
  /** Server-derived: a fingerprint is a hash of the id, never a slice of it. */
  actor_fingerprint?: string | null
  timestamp: number
}

interface AuditTimelineProps {
  kind: string
  object: string | number
  /**
   * Loads one page of an object's audit trail: the first without `after`, each
   * later one with the `next` the page before it answered. Held in a ref, so an
   * inline arrow does not refetch.
   */
  fetchAudit: (params: {
    kind: string
    object: string
    limit: number
    after?: string
  }) => Promise<{ audit: AuditTimelineEntry[]; next?: string; total?: number }>
  /** Localised label per action key; unknown keys fall back to the key. */
  actionLabels: Record<string, string>
  /**
   * Localised label per actor value the caller's domain gives an entry it
   * names nobody on, such as one acted on by staff the reader is not told of.
   * "system" is labelled here.
   */
  actorLabels?: Record<string, string>
  /** Localised detail line built from the entry's parsed data. */
  formatDetail?: (
    data: Record<string, unknown> | null,
    action: string
  ) => string | null
  /** Renders the actor's fingerprint when the entry carries no actor name. */
  formatFingerprint: (fingerprint: string) => string
  title?: string
}

const PAGE = 100

/**
 * An object's audit trail, in a card. Renders nothing while loading, when
 * empty, or when the fetch fails. The vocabulary is app domain: the caller
 * supplies the action labels and the detail formatter.
 */
export function AuditTimeline({
  kind,
  object,
  fetchAudit,
  actionLabels,
  actorLabels,
  formatDetail,
  formatFingerprint,
  title,
}: AuditTimelineProps) {
  const { t } = useLingui()
  const { formatTimestamp } = useFormat()
  const resolvedTitle = title ?? t`History`
  const [entries, setEntries] = useState<AuditTimelineEntry[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  // The cursor of the page that follows, "" or absent when none does.
  const [next, setNext] = useState<string | undefined>(undefined)
  const [total, setTotal] = useState<number | undefined>(undefined)
  const [loadingMore, setLoadingMore] = useState(false)

  const fetchRef = useRef(fetchAudit)
  // The macro needs a literal `t` tag, so the message is built during render
  // and read from a ref - that keeps `t` out of the fetch deps below.
  const failureMessage = t`Failed to load history`
  const messageRef = useRef(failureMessage)
  useEffect(() => {
    fetchRef.current = fetchAudit
    messageRef.current = failureMessage
  })
  // The object the shown trail belongs to, so a page that arrives after the
  // dialog has moved on to another object is dropped.
  const shownRef = useRef('')

  useEffect(() => {
    let cancelled = false
    const target = `${kind}\n${object}`
    shownRef.current = target
    // Clear both, or the previous object's trail stays on screen under the new
    // heading, and an error on one object would blank every later one.
    setEntries(null)
    setError(null)
    setNext(undefined)
    setTotal(undefined)
    setLoadingMore(false)
    fetchRef
      .current({ kind, object: String(object), limit: PAGE })
      .then((r) => {
        if (cancelled) return
        setEntries(r.audit)
        setNext(r.next)
        setTotal(r.total)
      })
      .catch((err) => {
        if (!cancelled) setError(getErrorMessage(err, messageRef.current))
      })
    return () => {
      cancelled = true
    }
  }, [kind, object])

  async function loadMore() {
    if (!next || loadingMore || !entries) return
    const target = shownRef.current
    const after = next
    setLoadingMore(true)
    try {
      const r = await fetchRef.current({
        kind,
        object: String(object),
        limit: PAGE,
        after,
      })
      if (shownRef.current !== target) return
      const held = new Set(entries.map((entry) => entry.id))
      const fresh = r.audit.filter((entry) => !held.has(entry.id))
      setEntries([...entries, ...fresh])
      if (r.total !== undefined) setTotal(r.total)
      // A page that adds nothing, or hands back the cursor it was asked with,
      // ends the trail rather than asking again.
      setNext(fresh.length === 0 || r.next === after ? '' : r.next)
    } catch (err) {
      if (shownRef.current === target) {
        toast.error(getErrorMessage(err, messageRef.current))
      }
    } finally {
      if (shownRef.current === target) setLoadingMore(false)
    }
  }

  if (error) return null
  if (!entries || entries.length === 0) return null

  return (
    <Card className='rounded-lg'>
      <CardContent className='p-5'>
        <h3 className='mb-4 font-semibold'>{resolvedTitle}</h3>
        <ActivityTimeline
          items={entries.map((entry) => {
            const label = actionLabels[entry.action] ?? t`Unknown`
            const detail = formatDetail?.(parseData(entry.data), entry.action)
            const actor =
              entry.actor === 'system'
                ? t({ message: 'System', context: 'actor' })
                : entry.actor_name ||
                  actorLabels?.[entry.actor] ||
                  formatFingerprint(entry.actor_fingerprint ?? '')
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
                  {formatTimestamp(entry.timestamp)}
                  {actor && ` · ${actor}`}
                </p>
              ),
            }
          })}
        />
        {next ? (
          <LoadMore
            hasMore
            isLoading={loadingMore}
            onLoadMore={() => void loadMore()}
            totalShown={entries.length}
            total={total ?? entries.length}
          />
        ) : null}
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
