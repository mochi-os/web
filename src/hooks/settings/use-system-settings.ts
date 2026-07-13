// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: Apache-2.0

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { SystemSettingsData } from '../../types/settings'
import { apiClient } from '../../lib/api-client'

const NO_TOAST = { mochi: { showGlobalErrorToast: false } } as const

export function useSystemSettingsData(endpoint: string) {
  return useQuery({
    queryKey: ['system', 'settings', endpoint],
    queryFn: async () => {
      const response = await apiClient.get<SystemSettingsData>(endpoint)
      return response.data
    },
  })
}

export function useSetSystemSetting(endpoint: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (data: { name: string; value: string }) => {
      const response = await apiClient.post(endpoint, data, NO_TOAST)
      return response.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['system', 'settings'] })
    },
  })
}
