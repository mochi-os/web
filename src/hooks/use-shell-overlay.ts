import { useEffect } from 'react'
import { shellSetOverlay } from '../lib/shell-bridge'

/**
 * Signals the shell to dim its chrome (lower #menu z-index) while a
 * full-screen panel is mounted. Call this inside the panel component that
 * owns the Sheet/Drawer — not inside the primitive itself.
 *
 * Relies on the component being conditionally rendered (mounted = open).
 * For always-mounted components, use the `open` param instead.
 */
export function useShellOverlay(open = true) {
  useEffect(() => {
    if (!open) return
    shellSetOverlay(true)
    return () => shellSetOverlay(false)
  }, [open])
}
