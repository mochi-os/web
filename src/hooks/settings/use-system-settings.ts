// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: Apache-2.0

import {
  queryOptions,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query'
import type { SystemSettingsData } from '../../types/settings'
import { apiClient } from '../../lib/api-client'

const NO_TOAST = { mochi: { showGlobalErrorToast: false } } as const

/**
 * The server's settings, as the hook below and a route's loader ask for
 * them. Fresh only across the page mounting after its loader: another
 * administrator may change them, so a later visit asks again.
 */
export function systemSettingsQuery(endpoint: string) {
  return queryOptions({
    queryKey: ['system', 'settings', endpoint],
    queryFn: async () => {
      const response = await apiClient.get<SystemSettingsData>(endpoint) // method-ok: systemSettingsQuery itself; the gate scans its callers
      return response.data
    },
    staleTime: 3_000,
  })
}

export function useSystemSettingsData(endpoint: string) {
  return useQuery(systemSettingsQuery(endpoint)) // method-ok: useSystemSettingsData itself; the gate scans its callers
}

export function useSetSystemSetting(endpoint: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (data: {
      name: string
      value: string
      token?: string
    }) => {
      const response = await apiClient.post(endpoint, data, NO_TOAST)
      return response.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['system', 'settings'] })
    },
  })
}
