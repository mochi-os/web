// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: Apache-2.0

// The find route crm and projects each grew privately. Both were the same
// 100-line wrapper around FindEntityPage with the app noun swapped: the same
// recommendations query, the same accessible-id memo, the same subscribe
// handler, the same probe. 78 of crm's 84 code lines matched projects'.
//
// The four other apps that hold a find route (feeds, forums, repos, wikis)
// share nothing with these two beyond FindEntityPage itself, so they are left
// alone.
//
// Every string arrives resolved from the app, for the reason given in
// entity-list-page.tsx.

import { useCallback, useMemo, type ComponentProps } from 'react'
import { useQuery } from '@tanstack/react-query'
import type { LucideIcon } from 'lucide-react'
import { FindEntityPage } from '../search-entity-page'
import { getErrorMessage } from '../../lib/handle-server-error'
import { toastAction } from '../../lib/toast-action'

// What FindEntityPage expects a probed URL to resolve to. Taken off its own
// props rather than restated, since the directory entry type is private to it.
type ResolvedEntry = Awaited<
  ReturnType<NonNullable<ComponentProps<typeof FindEntityPage>['resolveUri']>>
>

/** The rows the app's sidebar store already holds. */
export interface EntityFindRow {
  id: string
  fingerprint: string
}

export interface EntityFindApi {
  recommendations: () => Promise<{ data?: Record<string, unknown> }>
  subscribe: (
    id: string,
    location?: string,
    peer?: string,
  ) => Promise<unknown>
  probe: (url: string) => Promise<{ data?: Record<string, unknown> } & Record<string, unknown>>
}

export interface EntityFindPageLabels {
  title: string
  placeholder: string
  emptyMessage: string
  subscribing: string
  subscribed: string
  subscribeFailed: string
}

export interface EntityFindPageProps<TRow extends EntityFindRow> {
  api: EntityFindApi
  /** Key the recommendations come back under: `crms`, `projects`. */
  listKey: string
  /** Query key root for the recommendations query. */
  queryKey: string
  /** Containers the reader already has, from the app's sidebar store. */
  rows: TRow[]
  refresh: () => Promise<void> | void
  entityClass: string
  searchEndpoint: string
  icon: LucideIcon
  iconClassName?: string
  labels: EntityFindPageLabels
  /** Where a fresh subscription takes the reader. */
  onOpen: (id: string) => void | Promise<unknown>
}

export function EntityFindPage<TRow extends EntityFindRow>({
  api,
  listKey,
  queryKey,
  rows,
  refresh,
  entityClass,
  searchEndpoint,
  icon,
  iconClassName,
  labels,
  onOpen,
}: EntityFindPageProps<TRow>) {
  const {
    data: recommendationsData,
    isLoading: isLoadingRecommendations,
    isError: isRecommendationsError,
    error: recommendationsError,
    refetch: refetchRecommendations,
  } = useQuery({
    queryKey: [queryKey, 'recommendations'],
    queryFn: () => api.recommendations(),
    retry: false,
    refetchOnWindowFocus: false,
  })
  const recommendations = (recommendationsData?.data?.[listKey] ?? []) as never[]

  const accessibleIds = useMemo(
    () =>
      new Set(
        rows.flatMap((row) =>
          [row.id, row.fingerprint].filter((x): x is string => !!x),
        ),
      ),
    [rows],
  )

  const handleSubscribe = useCallback(
    async (
      id: string,
      entity: { fingerprint?: string; location?: string; peer?: string },
    ) => {
      try {
        await toastAction(api.subscribe(id, entity.location, entity.peer), {
          loading: labels.subscribing,
          success: labels.subscribed,
          error: (e) => getErrorMessage(e, labels.subscribeFailed),
        })
        await refresh()
        // `||`, not `??`: a probed remote with no fingerprint of its own comes
        // back carrying "" rather than nothing (see action_search in the app's
        // Starlark), and an empty id routes to the list root.
        await onOpen(entity.fingerprint || id)
      } catch {
        // toast already shown
      }
    },
    [api, labels, refresh, onOpen],
  )

  // Resolve a pasted mochi:// share link to the container's name via probe, so
  // the card shows the real container rather than a raw entity id.
  const resolveUri = useCallback(
    async (url: string) => {
      const response = await api.probe(url)
      const data = (response.data ?? response) as {
        id?: string
        server?: string
        peer?: string
      }
      if (!data?.id) return null
      return {
        ...data,
        location: data.server ?? '',
        peer: data.peer,
      } as ResolvedEntry
    },
    [api],
  )

  return (
    <FindEntityPage
      resolveUri={resolveUri}
      onSubscribe={handleSubscribe}
      subscribedIds={accessibleIds}
      entityClass={entityClass}
      searchEndpoint={searchEndpoint}
      icon={icon}
      iconClassName={iconClassName}
      title={labels.title}
      placeholder={labels.placeholder}
      emptyMessage={labels.emptyMessage}
      recommendations={recommendations}
      isLoadingRecommendations={isLoadingRecommendations}
      isRecommendationsError={isRecommendationsError}
      recommendationsError={recommendationsError}
      onRetryRecommendations={() => {
        void refetchRecommendations()
      }}
    />
  )
}
