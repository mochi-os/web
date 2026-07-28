// Copyright © 2026 Mochisoft OÜ
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

// Clear specific preferences, each falling back to its default. Sent
// form-encoded with a repeated `key` field: the server reads these with
// a.inputs(), which only sees query/form arrays — a JSON body is flattened
// to one string per key and would arrive as a single mangled value.
export function useUnsetPreferences(endpoint: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (keys: string[]) => {
      const form = new URLSearchParams()
      for (const key of keys) form.append('key', key)
      const response = await apiClient.post(endpoint, form.toString(), {
        ...NO_TOAST,
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      })
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
