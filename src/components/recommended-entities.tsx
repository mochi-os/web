// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: Apache-2.0

// The "Recommended <nouns>" block an app shows under its empty state, beside
// InlineEntitySearch. `load` and `onSubscribe` are the app's own calls. Renders
// null once nothing is left to recommend.

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { t } from '@lingui/core/macro'
import { Loader2, type LucideIcon } from 'lucide-react'
import { Button } from './ui/button'
import { Skeleton } from './ui/skeleton'
import { GeneralError } from '../features/errors/general-error'
import { cn } from '../lib/utils'

export interface RecommendedEntityItem {
  id: string
  name: string
  /** one-line description from the directory */
  blurb?: string
  fingerprint?: string
}

export interface RecommendedEntitiesProps<T extends RecommendedEntityItem> {
  /** Ids and fingerprints already subscribed; matching rows are hidden. */
  subscribedIds: Set<string>
  /** Fetch the recommendations. Retried by the error state's reset. */
  load: () => Promise<T[]>
  /** Subscribe and do whatever the app does next. Owns its own toasts. */
  onSubscribe: (item: T) => Promise<void> | void
  icon: LucideIcon
  /** Tailwind classes for the icon tile, e.g. 'bg-orange-500/10 text-orange-600'. */
  iconClassName?: string
  /** Heading above the list, e.g. "Recommended feeds". */
  title: ReactNode
  /** Fallback message when the load throws something that is not an Error. */
  errorMessage: string
  subscribeLabel?: ReactNode
}

function Frame({ children }: { children: ReactNode }) {
  return (
    <>
      <hr className='my-6 w-full max-w-md border-t' />
      <div className='w-full max-w-md'>{children}</div>
    </>
  )
}

export function RecommendedEntities<T extends RecommendedEntityItem>({
  subscribedIds,
  load,
  onSubscribe,
  icon: Icon,
  iconClassName = 'bg-primary/10 text-primary',
  title,
  errorMessage,
  subscribeLabel = t`Subscribe`,
}: RecommendedEntitiesProps<T>) {
  const [recommendations, setRecommendations] = useState<T[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)
  const [pendingId, setPendingId] = useState<string | null>(null)

  const loadRef = useRef(load)
  loadRef.current = load
  const errorMessageRef = useRef(errorMessage)
  errorMessageRef.current = errorMessage

  const fetchRecommendations = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      setRecommendations(await loadRef.current())
    } catch (loadError) {
      setRecommendations([])
      setError(
        loadError instanceof Error
          ? loadError
          : new Error(errorMessageRef.current)
      )
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    void fetchRecommendations()
  }, [fetchRecommendations])

  const handleSubscribe = async (item: T) => {
    setPendingId(item.id)
    try {
      await onSubscribe(item)
      setRecommendations((prev) => prev.filter((row) => row.id !== item.id))
    } catch {
      // onSubscribe owns its own toast; swallowing here keeps a rejected
      // subscribe from surfacing as an unhandled rejection off the click.
    } finally {
      setPendingId(null)
    }
  }

  const visible = recommendations.filter(
    (item) =>
      !subscribedIds.has(item.id) &&
      !(item.fingerprint && subscribedIds.has(item.fingerprint))
  )

  if (isLoading) {
    return (
      <Frame>
        <Skeleton className='mb-3 h-4 w-32' />
        <div className='divide-border divide-y rounded-lg border'>
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className='flex items-center gap-3 px-4 py-3'>
              <Skeleton className='h-8 w-8 rounded-md' />
              <div className='flex-1 space-y-1'>
                <Skeleton className='h-4 w-3/4' />
                <Skeleton className='h-3 w-1/2' />
              </div>
              <Skeleton className='h-8 w-20' />
            </div>
          ))}
        </div>
      </Frame>
    )
  }

  if (error) {
    return (
      <Frame>
        <p className='text-muted-foreground mb-3 text-xs font-medium tracking-wide uppercase'>
          {title}
        </p>
        <GeneralError
          error={error}
          minimal
          mode='inline'
          reset={fetchRecommendations}
        />
      </Frame>
    )
  }

  if (visible.length === 0) {
    return null
  }

  return (
    <Frame>
      <p className='text-muted-foreground mb-3 text-xs font-medium tracking-wide uppercase'>
        {title}
      </p>
      <div className='divide-border divide-y rounded-lg border text-start'>
        {visible.map((item) => {
          const isPending = pendingId === item.id

          return (
            <div
              key={item.id}
              className='hover:bg-hover flex items-center justify-between gap-3 px-4 py-3 transition-colors'
            >
              <div className='flex min-w-0 flex-1 items-center gap-3'>
                <div
                  className={cn(
                    'flex h-8 w-8 shrink-0 items-center justify-center rounded-md',
                    iconClassName
                  )}
                >
                  <Icon className='h-4 w-4' />
                </div>
                <div className='flex min-w-0 flex-1 flex-col'>
                  <span className='truncate text-sm font-medium'>
                    {item.name}
                  </span>
                  {item.blurb && (
                    <span className='text-muted-foreground truncate text-xs'>
                      {item.blurb}
                    </span>
                  )}
                </div>
              </div>
              <Button
                size='sm'
                onClick={() => handleSubscribe(item)}
                disabled={isPending}
              >
                {isPending ? (
                  <Loader2 className='h-4 w-4 animate-spin' />
                ) : (
                  subscribeLabel
                )}
              </Button>
            </div>
          )
        })}
      </div>
    </Frame>
  )
}
