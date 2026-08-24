// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: Apache-2.0

import { useEffect } from 'react'

import { isInShell, shellOrigin } from '../lib/shell-bridge'

let shellOverlayCount = 0

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
    }

    return () => {
      shellOverlayCount = Math.max(0, shellOverlayCount - 1)
      if (shellOverlayCount === 0) {
        setShellOverlay(false)
      }
    }
  }, [open])
}
