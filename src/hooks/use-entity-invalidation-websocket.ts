// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: Apache-2.0

import { useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useAuthStore } from '../stores/auth-store'
import {
  entityWebsocketManager,
  type EntityWebsocketEvent,
} from '../lib/entity-websocket-manager'

export interface UseEntityInvalidationWebsocketOptions {
  /** Fingerprint of the subscribed entity. Undefined means do not connect. */
  fingerprint?: string
  /** WebSocket event types to listen for. */
  eventTypes: string[]
  /** React Query key to invalidate when a matching event arrives. */
  queryKey: unknown[]
}

/**
 * Subscribe to an entity's WebSocket events and invalidate a query key when
 * any specified event type is received.
 */
export function useEntityInvalidationWebsocket({
  fingerprint,
  eventTypes,
  queryKey,
}: UseEntityInvalidationWebsocketOptions) {
  const queryClient = useQueryClient()
  const authReady = useAuthStore((state) => state.isInitialized)
  const authToken = useAuthStore((state) => state.token)

  useEffect(() => {
    if (!authReady) return
    if (!fingerprint) return

    const handleMessage = (data: EntityWebsocketEvent) => {
      if (eventTypes.includes(data.type)) {
        void queryClient.invalidateQueries({ queryKey })
      }
    }

    return entityWebsocketManager.subscribe(fingerprint, handleMessage)
  }, [authReady, authToken, fingerprint, queryClient, eventTypes, queryKey])
}
