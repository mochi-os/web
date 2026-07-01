// Copyright © 2026 Mochi OÜ
// SPDX-License-Identifier: Apache-2.0

import { useMemo } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { requestHelpers } from '../lib/request'
import { handlePermissionError } from '../lib/permission-utils'
import type {
  Account,
  AccountTestResult,
  Provider,
  AccountsHookResult,
} from '../features/accounts/types'

const NO_TOAST = { mochi: { showGlobalErrorToast: false } } as const

const formPost = () =>
  ({
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    ...NO_TOAST,
  }) as const

// Extract app ID from appBase path (e.g., "/notifications" -> "notifications")
function getAppIdFromBase(appBase: string): string {
  return appBase.replace(/^\//, '').split('/')[0] || ''
}

// Check if error is a permission error and handle it
function checkPermissionError(error: unknown, appId: string): void {
  if (error && typeof error === 'object' && 'data' in error) {
    // ApiError structure: error.data contains the response data
    const apiError = error as { data?: unknown }
    if (apiError.data) {
      handlePermissionError(apiError.data, appId)
    }
  }
}

export function useAccounts(
  appBase: string,
  capability?: string
): AccountsHookResult {
  const queryClient = useQueryClient()
  const queryParams = capability ? `?capability=${capability}` : ''
  const appId = getAppIdFromBase(appBase)

  const {
    data: providersData,
    isLoading: isProvidersLoading,
    error: providersError,
  } = useQuery({
    queryKey: ['accounts', 'providers', appBase, capability],
    queryFn: async () => {
      try {
        const res = await requestHelpers.get<Provider[]>(
          `${appBase}/-/accounts/providers${queryParams}`
        )
        return res || []
      } catch (error) {
        checkPermissionError(error, appId)
        throw error
      }
    },
    staleTime: Infinity,
  })

  const {
    data: accountsData,
    isLoading: isAccountsLoading,
    error: accountsError,
    refetch,
  } = useQuery({
    queryKey: ['accounts', 'list', appBase, capability],
    queryFn: async () => {
      try {
        const res = await requestHelpers.get<Account[]>(
          `${appBase}/-/accounts/list${queryParams}`
        )
        return res || []
      } catch (error) {
        checkPermissionError(error, appId)
        throw error
      }
    },
  })

  // Memoize to prevent unstable references during loading
  // Use Array.isArray to handle cases where API returns non-array data
  const providers = useMemo(() => Array.isArray(providersData) ? providersData : [], [providersData])
  const accounts = useMemo(() => Array.isArray(accountsData) ? accountsData : [], [accountsData])

  const addMutation = useMutation({
    mutationFn: async ({
      type,
      fields,
      addToExisting,
    }: {
      type: string
      fields: Record<string, string>
      addToExisting: boolean
    }) => {
      const formData = new URLSearchParams()
      formData.append('type', type)
      for (const [key, value] of Object.entries(fields)) {
        formData.append(key, value)
      }
      formData.append('add_to_existing', addToExisting ? '1' : '0')

      const res = await requestHelpers.post<Account>(
        `${appBase}/-/accounts/add`,
        formData.toString(),
        formPost()
      )
      return res
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['accounts', 'list', appBase],
      })
    },
  })

  const removeMutation = useMutation({
    mutationFn: async (id: string) => {
      const formData = new URLSearchParams()
      formData.append('id', id)

      const res = await requestHelpers.post<boolean>(
        `${appBase}/-/accounts/remove`,
        formData.toString(),
        formPost()
      )
      return res === true
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['accounts', 'list', appBase],
      })
    },
  })

  const updateMutation = useMutation({
    mutationFn: async ({
      id,
      fields,
    }: {
      id: string
      fields: Record<string, string>
    }) => {
      const formData = new URLSearchParams()
      formData.append('id', id)
      for (const [key, value] of Object.entries(fields)) {
        formData.append(key, value)
      }

      const res = await requestHelpers.post<boolean>(
        `${appBase}/-/accounts/update`,
        formData.toString(),
        formPost()
      )
      return res === true
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['accounts', 'list', appBase],
      })
    },
  })

  const verifyMutation = useMutation({
    mutationFn: async ({ id, code }: { id: string; code?: string }) => {
      const formData = new URLSearchParams()
      formData.append('id', id)
      if (code) {
        formData.append('code', code)
      }

      const res = await requestHelpers.post<boolean>(
        `${appBase}/-/accounts/verify`,
        formData.toString(),
        formPost()
      )
      return res === true
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['accounts', 'list', appBase],
      })
    },
  })

  const testMutation = useMutation({
    mutationFn: async (id: string) => {
      const formData = new URLSearchParams()
      formData.append('id', id)

      const res = await requestHelpers.post<AccountTestResult>(
        `${appBase}/-/accounts/test`,
        formData.toString(),
        formPost()
      )
      return res
    },
  })

  return {
    providers,
    accounts,
    isLoading: isProvidersLoading || isAccountsLoading,
    isProvidersLoading,
    isAccountsLoading,
    providersError,
    accountsError,
    add: async (type: string, fields: Record<string, string>, addToExisting = true) => {
      const result = await addMutation.mutateAsync({ type, fields, addToExisting })
      if (!result) throw new Error("Failed to add account")
      return result
    },
    remove: async (id: string) => {
      return removeMutation.mutateAsync(id)
    },
    update: async (id: string, fields: Record<string, string>) => {
      return updateMutation.mutateAsync({ id, fields })
    },
    verify: async (id: string, code?: string) => {
      return verifyMutation.mutateAsync({ id, code })
    },
    test: async (id: string) => {
      return testMutation.mutateAsync(id)
    },
    refetch: () => refetch(),
    isAdding: addMutation.isPending,
    isRemoving: removeMutation.isPending,
    isVerifying: verifyMutation.isPending,
    isTesting: testMutation.isPending,
  }
}
