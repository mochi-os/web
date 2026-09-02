// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: Apache-2.0

import { useEffect } from 'react'

import { isInShell, shellOrigin } from '../lib/shell-bridge'

// The shell releases the overlay on its own a while after the last assertion,
// so a panel that stays open keeps re-asserting it. A frame that crashes or
// navigates away stops, and the menu comes back without a reload.
const HEARTBEAT_MS = 5000

let shellOverlayCount = 0
let shellOverlayHeartbeat: number | null = null

function setShellOverlay(open: boolean) {
  if (typeof window === 'undefined' || !isInShell()) return
  window.parent.postMessage({ type: 'overlay', open }, shellOrigin())
}

export function useShellOverlay(open = true) {
  useEffect(() => {
    if (!open || typeof window === 'undefined' || !isInShell()) return

    shellOverlayCount += 1
    if (shellOverlayCount === 1) {
      setShellOverlay(true)
      shellOverlayHeartbeat = window.setInterval(() => setShellOverlay(true), HEARTBEAT_MS)
    }

    return () => {
      shellOverlayCount = Math.max(0, shellOverlayCount - 1)
      if (shellOverlayCount === 0) {
        if (shellOverlayHeartbeat !== null) {
          window.clearInterval(shellOverlayHeartbeat)
          shellOverlayHeartbeat = null
        }
        setShellOverlay(false)
      }
    }
  }, [open])
}
