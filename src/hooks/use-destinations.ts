// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: Apache-2.0

import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { requestHelpers } from '../lib/request'
import { getProviderLabel } from '../features/accounts/types'
import { handlePermissionError } from '../lib/permission-utils'

// Extract app ID from base path (e.g., "/people" -> "people")
function getAppIdFromBase(base: string): string {
  return base.replace(/^\//, '').split('/')[0] || ''
}

// Destination represents a place where notifications can be sent
export interface Destination {
  type: 'account' | 'rss'
  accountType?: string  // 'browser', 'email', 'url' for accounts
  id: number | string
  label: string
  identifier?: string
  defaultEnabled: boolean
}

interface Feed {
  id: string
  name: string
  enabled: number
}

interface DestinationsResponse {
  accounts: Array<{
    id: number
    type: string
    label: string
    identifier: string
    enabled: number
  }>
  feeds: Feed[]
}

export interface UseDestinationsResult {
  destinations: Destination[]
  isLoading: boolean
  isError: boolean
  error: Error | null
  refetch: () => void
}

// Hook to fetch available notification destinations
// Uses the app's notifications/destinations proxy endpoint
export function useDestinations(appBase: string = ''): UseDestinationsResult {
  const appId = getAppIdFromBase(appBase)

  const { data: destinationsData, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['destinations', appBase],
    queryFn: async () => {
      try {
        return await requestHelpers.get<DestinationsResponse>(
          `${appBase}/-/notifications/destinations`
        )
      } catch (error) {
        if (error && typeof error === 'object' && 'data' in error) {
          const apiError = error as { data?: unknown }
          if (apiError.data) {
            handlePermissionError(apiError.data, appId)
          }
        }
        throw error
      }
    },
  })

  // Transform accounts and feeds into unified destination list
  const destinations = useMemo((): Destination[] => {
    const accountsRaw = destinationsData?.accounts
    const feedsRaw = destinationsData?.feeds
    const accountsList = Array.isArray(accountsRaw) ? accountsRaw : []
    const feedsList = Array.isArray(feedsRaw) ? feedsRaw : []
    return [
      ...accountsList.map((account) => ({
        type: 'account' as const,
        accountType: account.type,
        id: account.id,
        label: account.label || account.identifier || getProviderLabel(account.type),
        identifier: account.identifier,
        defaultEnabled: account.enabled === 1,
      })),
      ...feedsList.map((feed) => ({
        type: 'rss' as const,
        id: feed.id,
        label: feed.name,
        identifier: undefined,
        defaultEnabled: feed.enabled === 1,
      })),
    ]
  }, [destinationsData])

  return {
    destinations,
    isLoading,
    isError,
    error: error as Error | null,
    refetch,
  }
}
