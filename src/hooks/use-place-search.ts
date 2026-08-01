// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: Apache-2.0

// Hook for searching places with debouncing

import { useQuery } from '@tanstack/react-query'
import { useState, useEffect } from 'react'
import { searchPlaces } from '../lib/places-api'
import type { PhotonPlace } from '../types/places'

interface UsePlaceSearchOptions {
  debounceMs?: number
  enabled?: boolean
  limit?: number
}

export function usePlaceSearch(query: string, options: UsePlaceSearchOptions = {}) {
  const { debounceMs = 300, enabled = true, limit = 10 } = options
  const [debouncedQuery, setDebouncedQuery] = useState(query)

  // Debounce the query
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(query)
    }, debounceMs)

    return () => clearTimeout(timer)
  }, [query, debounceMs])

  const result = useQuery<PhotonPlace[], Error>({
    queryKey: ['places', 'search', debouncedQuery, limit],
    // Forward react-query's signal: without it a superseded search still runs
    // to completion, so typing sends more queries to the geocoder than the
    // user actually made.
    queryFn: ({ signal }) => searchPlaces(debouncedQuery, limit, signal),
    enabled: enabled && debouncedQuery.trim().length >= 2,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
  })

  return {
    places: result.data ?? [],
    isLoading: result.isLoading,
    isFetching: result.isFetching,
    error: result.error,
  }
}
