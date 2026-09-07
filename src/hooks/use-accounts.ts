// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: Apache-2.0

import { useMemo } from 'react'
import { t } from '@lingui/core/macro'
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

// Check if error is a permission error and handle it
function checkPermissionError(error: unknown): void {
  if (error && typeof error === 'object' && 'data' in error) {
    // ApiError structure: error.data contains the response data
    const apiError = error as { data?: unknown }
    if (apiError.data) {
      handlePermissionError(apiError.data)
    }
  }
}

export function useAccounts(
  appBase: string,
  capability?: string
): AccountsHookResult {
  const queryClient = useQueryClient()
  const queryParams = capability ? `?capability=${capability}` : ''

  // The two hooks below silence query/exhaustive-deps: queryParams is derived
  // from capability, which is already in the key, so it varies with everything
  // the request varies with. The rule cannot follow a derived value.
  const {
    data: providersData,
    isLoading: isProvidersLoading,
    error: providersError,
  } = useQuery({ // eslint-disable-line @tanstack/query/exhaustive-deps
    queryKey: ['accounts', 'providers', appBase, capability],
    queryFn: async () => {
      try {
        const res = await requestHelpers.get<Provider[]>(
          `${appBase}/-/accounts/providers${queryParams}`
        )
        return res || []
      } catch (error) {
        checkPermissionError(error)
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
  } = useQuery({ // eslint-disable-line @tanstack/query/exhaustive-deps
    queryKey: ['accounts', 'list', appBase, capability],
    queryFn: async () => {
      try {
        const res = await requestHelpers.get<Account[]>(
          `${appBase}/-/accounts/list${queryParams}`
        )
        return res || []
      } catch (error) {
        checkPermissionError(error)
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

  // JSON rather than a form body: clearing a field sends "", and an empty form
  // value is indistinguishable from an absent one by the time it reaches
  // a.input(), so the clear was silently dropped. Only a JSON body preserves it.
  const updateMutation = useMutation({
    mutationFn: async ({
      id,
      fields,
    }: {
      id: string
      fields: Record<string, string>
    }) => {
      const res = await requestHelpers.post<boolean>(
        `${appBase}/-/accounts/update`,
        { id, ...fields },
        NO_TOAST
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
      if (!result) throw new Error(t`Failed to add account`)
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
