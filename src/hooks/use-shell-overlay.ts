// Copyright © 2026 Mochi OÜ
// SPDX-License-Identifier: Apache-2.0

import { useEffect } from 'react'

import { isInShell } from '../lib/shell-bridge'

let shellOverlayCount = 0

function setShellOverlay(open: boolean) {
  if (typeof window === 'undefined' || !isInShell()) return
  window.parent.postMessage({ type: 'overlay', open }, '*')
}

export function useShellOverlay(open = true) {
  useEffect(() => {
    if (!open || typeof window === 'undefined' || !isInShell()) return

    shellOverlayCount += 1
    if (shellOverlayCount === 1) {
      setShellOverlay(true)
    }

    return () => {
      shellOverlayCount = Math.max(0, shellOverlayCount - 1)
      if (shellOverlayCount === 0) {
        setShellOverlay(false)
      }
    }
  }, [open])
}
