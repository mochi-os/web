// Copyright © 2026 Mochi OÜ
// SPDX-License-Identifier: Apache-2.0

import { useEffect } from 'react'

import { isInShell, shellSetImmersive } from '../lib/shell-bridge'

// While `on`, ask the Mochi shell to hide its chrome (the menu with the Mochi and
// user icons) for an immersive, full-bleed view — typically paired with the
// browser Fullscreen API.
//
// Safety: this keeps the chrome hidden via a ~2s heartbeat that the shell
// watchdogs. If the heartbeat stops — the app crashes, freezes, the tab is
// backgrounded, or the browser is closed — the shell automatically restores its
// chrome a few seconds later, so the menu can never be permanently lost. The
// hook also restores immediately when `on` goes false or the component unmounts.
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
