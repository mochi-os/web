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
      return { label: 'Connected', color: 'bg-green-500' }
    case 'connecting':
      return {
        label: retries > 0 ? `Reconnecting (${retries})...` : 'Connecting...',
        color: 'bg-yellow-500',
      }
    case 'error':
      return { label: 'Disconnected', color: 'bg-red-500' }
    case 'idle':
    case 'closing':
    default:
      return { label: 'Disconnected', color: 'bg-slate-500' }
  }
}

export function getChatBubbleToneClass(isSent: boolean): string {
  return isSent
    ? 'rounded-[14px] rounded-br-[4px] bg-primary text-primary-foreground'
    : 'rounded-[14px] rounded-bl-[4px] bg-muted text-foreground'
}
