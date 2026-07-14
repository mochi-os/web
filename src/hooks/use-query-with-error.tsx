// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: Apache-2.0

import { useQuery, useInfiniteQuery, type UseQueryOptions, type UseInfiniteQueryOptions, type QueryKey } from '@tanstack/react-query'
import { GeneralError } from '../features/errors/general-error'

/**
 * A wrapper around TanStack useQuery that provides a consistent ErrorComponent
 * to be used in the application for error feedback.
 */
export function useQueryWithError<
  TQueryFnData = unknown,
  TError = unknown,
  TData = TQueryFnData,
  TQueryKey extends QueryKey = QueryKey,
>(
  options: UseQueryOptions<TQueryFnData, TError, TData, TQueryKey>
) {
  const query = useQuery(options)

  return {
    ...query,
    ErrorComponent: query.isError ? (
      <GeneralError 
        error={query.error} 
        minimal 
        reset={query.refetch}
        mode='inline'
      />
    ) : null,
  }
}

/**
 * A wrapper around TanStack useInfiniteQuery that provides a consistent ErrorComponent
 * to be used in the application for error feedback.
 */
export function useInfiniteQueryWithError<
  TQueryFnData = unknown,
  TError = unknown,
  TData = TQueryFnData,
  TQueryKey extends QueryKey = QueryKey,
  TPageParam = unknown,
>(
  options: UseInfiniteQueryOptions<TQueryFnData, TError, TData, TQueryKey, TPageParam>
) {
  const query = useInfiniteQuery(options)

  return {
    ...query,
    ErrorComponent: query.isError ? (
      <GeneralError 
        error={query.error} 
        minimal 
        reset={query.refetch}
        mode='inline'
      />
    ) : null,
  }
}
