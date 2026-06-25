// Copyright © 2026 Mochi OÜ
// SPDX-License-Identifier: Apache-2.0

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { PreferencesData } from '../../types/settings'
import { apiClient } from '../../lib/api-client'

const NO_TOAST = { mochi: { showGlobalErrorToast: false } } as const

export function usePreferencesData(endpoint: string) {
  return useQuery({
    queryKey: ['user', 'preferences', endpoint],
    queryFn: async () => {
      const response = await apiClient.get<PreferencesData>(endpoint)
      return response.data
    },
  })
}

export function useSetPreference(endpoint: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (data: Record<string, string>) => {
      const response = await apiClient.post(endpoint, data, NO_TOAST)
      return response.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user', 'preferences'] })
    },
  })
}

export function useResetPreferences(endpoint: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async () => {
      const response = await apiClient.post(endpoint, undefined, NO_TOAST)
      return response.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user', 'preferences'] })
    },
  })
}
