// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: Apache-2.0

import { t } from '@lingui/core/macro'
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
      return { label: t`Connected`, color: 'bg-success' }
    case 'connecting':
      return {
        label: retries > 0 ? t`Reconnecting (${retries})...` : t`Connecting...`,
        color: 'bg-warning',
      }
    case 'error':
      return { label: t`Disconnected`, color: 'bg-destructive' }
    case 'idle':
    case 'closing':
    default:
      return { label: t`Disconnected`, color: 'bg-muted-foreground' }
  }
}

export function getChatBubbleToneClass(isSent: boolean): string {
  return isSent
    ? 'rounded-[14px] rounded-ee-[4px] bg-primary text-primary-foreground'
    : 'rounded-[14px] rounded-es-[4px] bg-muted text-foreground'
}
