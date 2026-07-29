// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: Apache-2.0

import { useContext } from 'react'
import { GameWebsocketContext } from '../context/game-websocket-context'

export const useGameWebsocketManager = () => {
  return useContext(GameWebsocketContext)
}
