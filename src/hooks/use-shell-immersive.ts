// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: Apache-2.0

import { useEffect } from 'react'

import { isInShell, shellSetImmersive } from '../lib/shell-bridge'

// While `on`, ask the shell to hide its chrome for a full-bleed view. A ~2s
// heartbeat keeps it hidden; if the heartbeat stops the shell restores the
// chrome itself, so a crashed app cannot lose the menu.
const HEARTBEAT_MS = 2000

export function useShellImmersive(on: boolean) {
  useEffect(() => {
    if (!on || !isInShell()) return
    shellSetImmersive(true)
    const heartbeat = window.setInterval(() => shellSetImmersive(true), HEARTBEAT_MS)
    return () => {
      window.clearInterval(heartbeat)
      shellSetImmersive(false)
    }
  }, [on])
}
