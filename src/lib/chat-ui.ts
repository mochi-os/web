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
      return { label: 'Connected', color: 'bg-primary' }
    case 'connecting':
      return {
        label: retries > 0 ? `Reconnecting (${retries})...` : 'Connecting...',
        color: 'bg-warning',
      }
    case 'error':
      return { label: 'Disconnected', color: 'bg-destructive' }
    case 'idle':
    case 'closing':
    default:
      return { label: 'Disconnected', color: 'bg-muted-foreground' }
  }
}

export function getChatBubbleToneClass(isSent: boolean): string {
  return isSent
    ? 'rounded-[14px] rounded-br-[4px] bg-primary text-primary-foreground'
    : 'rounded-[14px] rounded-bl-[4px] bg-secondary text-secondary-foreground'
}
