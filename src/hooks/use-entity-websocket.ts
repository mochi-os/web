// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: Apache-2.0

import { useEffect, useRef } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useAuthStore } from '../stores/auth-store'
import {
  entityWebsocketManager,
  type EntityWebsocketEvent,
} from '../lib/entity-websocket-manager'

interface UseEntityWebsocketOptions {
  /**
   * The app's entity noun, as it appears in both the server event type
   * (`<entity>/update`) and the root of the entity's query key. `'crm'` in the
   * crm app, `'project'` in projects.
   */
  entity: string
  /** Fingerprint of the subscribed entity. Undefined means do not connect. */
  fingerprint?: string
  /**
   * Called when a bulk sync batch lands. The entity, its schema and its
   * populated flag come from the route loader rather than react-query, so the
   * caller re-runs the loader here.
   */
  onSync?: () => void
}

/**
 * Subscribe to an entity's WebSocket events and invalidate the queries each
 * one affects.
 *
 * Shared by crm and projects, whose copies of this hook were 0.99 identical.
 * The event vocabulary below - comments, objects, values, links, attachments
 * and the design tree - is the entity object model both apps implement, so it
 * lives here rather than being passed in.
 */
export function useEntityWebsocket({
  entity,
  fingerprint,
  onSync,
}: UseEntityWebsocketOptions) {
  const queryClient = useQueryClient()
  const authReady = useAuthStore((state) => state.isInitialized)
  const authToken = useAuthStore((state) => state.token)
  // Keep the latest onSync without re-subscribing the socket on every render.
  const onSyncRef = useRef(onSync)
  onSyncRef.current = onSync

  useEffect(() => {
    if (!authReady) return
    if (!fingerprint) return

    const handleMessage = (data: EntityWebsocketEvent) => {
      const pid = fingerprint
      const invalidate = (queryKey: unknown[]) =>
        void queryClient.invalidateQueries({ queryKey })

      // Handled before the switch: an entity noun of 'object' would otherwise
      // produce a `case` that collides with 'object/update' below, and the
      // first matching case would win.
      if (data.type === `${entity}/update`) {
        // Arrives after a bulk sync batch (event_sync_batch) lands all of a
        // subscribed entity's data at once. The entity + schema + populated
        // flag come from the route loader (not a react-query key), so onSync()
        // re-runs the loader; the objects + people lists are react-query, so
        // invalidate those too. Together a freshly subscribed entity flips out
        // of its loading state the moment its data arrives.
        onSyncRef.current?.()
        invalidate(['objects', pid])
        invalidate(['people', pid])
        return
      }

      switch (data.type) {
        case 'comment/create':
        case 'comment/update':
        case 'comment/delete':
          if (data.object) {
            invalidate(['comments', pid, data.object])
            invalidate(['object', pid, data.object])
          }
          break
        case 'object/create':
        case 'object/update':
        case 'object/delete':
          invalidate(['objects', pid])
          if (data.id) invalidate(['object', pid, data.id])
          break
        case 'object/ranks':
          invalidate(['objects', pid])
          break
        case 'values/update':
          if (data.id) invalidate(['object', pid, data.id])
          invalidate(['objects', pid])
          break
        case 'link/create':
        case 'link/delete':
          if (data.source) invalidate(['object', pid, data.source])
          if (data.target) invalidate(['object', pid, data.target])
          break
        case 'attachment/add':
        case 'attachment/remove':
          if (data.object) invalidate(['attachments', pid, data.object])
          break
        case 'class/create':
        case 'class/update':
        case 'class/delete':
        case 'field/create':
        case 'field/update':
        case 'field/delete':
        case 'field/reorder':
        case 'option/create':
        case 'option/update':
        case 'option/delete':
        case 'option/reorder':
        case 'view/create':
        case 'view/update':
        case 'view/delete':
        case 'view/reorder':
        case 'hierarchy/set':
          invalidate([entity, pid])
          break
      }
    }

    return entityWebsocketManager.subscribe(fingerprint, handleMessage)
  }, [authReady, authToken, entity, fingerprint, queryClient])
}
