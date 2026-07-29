// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: Apache-2.0

import { createContext } from 'react'
import type { ChatWebsocketManager } from '../lib/realtime-websocket-manager'

export const GameWebsocketContext =
  createContext<ChatWebsocketManager | null>(null)
