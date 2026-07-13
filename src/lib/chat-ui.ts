// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: Apache-2.0

import type { WebsocketConnectionStatus } from './realtime-websocket-manager'

export type WebsocketStatusMeta = {
  label: string
  color: string
}

export function getWebsocketStatusMeta(
  status: WebsocketConnectionStatus,
  retries = 0
): WebsocketStatusMeta {
  switch (status) {
    case 'ready':
      return { label: "Connected", color: 'bg-success' }
    case 'connecting':
      return {
        label: retries > 0 ? `Reconnecting (${retries})...` : 'Connecting...',
        color: 'bg-warning',
      }
    case 'error':
      return { label: "Disconnected", color: 'bg-destructive' }
    case 'idle':
    case 'closing':
    default:
      return { label: "Disconnected", color: 'bg-muted-foreground' }
  }
}

export function getChatBubbleToneClass(isSent: boolean): string {
  return isSent
    ? 'rounded-[14px] rounded-ee-[4px] bg-primary text-primary-foreground'
    : 'rounded-[14px] rounded-es-[4px] bg-muted text-foreground'
}
