// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: Apache-2.0

import * as React from 'react'

/**
 * Standard Tailwind-compatible breakpoints
 */
const BREAKPOINTS = {
  sm: 640,
  md: 768,
  lg: 1024,
  xl: 1280,
  '2xl': 1536,
} as const

type ScreenSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl'

type UseScreenSizeReturn = {
  /** Current window width in pixels */
  width: number
  /** Current screen size category */
  size: ScreenSize
  /** True if width < 768px (mobile) */
  isMobile: boolean
  /** True if 768px <= width < 1024px (tablet) */
  isTablet: boolean
  /** True if width >= 1024px (desktop) */
  isDesktop: boolean
}

// One listener and one width for the whole app, read through
// useSyncExternalStore.
//
// This used to be per-component useState fed by a per-component resize
// listener. Every consumer then held its own copy of the width and flipped
// across a breakpoint in its own update, so during a resize two components
// could render from different widths in the same commit. ResponsiveDialog is
// where that showed: its root picked Drawer while its content was still
// DialogContent, and the portal threw "`DialogPortal` must be used within
// `Dialog`". A single snapshot cannot tear, so the root and its parts always
// agree.
let currentWidth = typeof window !== 'undefined' ? window.innerWidth : 0
const listeners = new Set<() => void>()

function handleResize() {
  const next = window.innerWidth
  if (next === currentWidth) return
  currentWidth = next
  for (const listener of listeners) listener()
}

function subscribe(listener: () => void): () => void {
  if (listeners.size === 0 && typeof window !== 'undefined') {
    // Read once on the first subscription: the module-level initialiser runs at
    // import time, which can predate the first paint.
    currentWidth = window.innerWidth
    window.addEventListener('resize', handleResize)
  }
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
    if (listeners.size === 0 && typeof window !== 'undefined') {
      window.removeEventListener('resize', handleResize)
    }
  }
}

function getSnapshot(): number {
  return currentWidth
}

function getServerSnapshot(): number {
  return 0
}

function screenSizeFor(width: number): ScreenSize {
  if (width >= BREAKPOINTS['2xl']) return '2xl'
  if (width >= BREAKPOINTS.xl) return 'xl'
  if (width >= BREAKPOINTS.lg) return 'lg'
  if (width >= BREAKPOINTS.md) return 'md'
  if (width >= BREAKPOINTS.sm) return 'sm'
  return 'xs'
}

/**
 * Comprehensive hook for screen size detection
 * Provides reactive window dimensions and semantic breakpoint helpers
 *
 * @returns Object with width, size, isMobile, isTablet, and isDesktop
 * @example
 * const { isMobile, size } = useScreenSize()
 * if (isMobile) { ... }
 */
export function useScreenSize(): UseScreenSizeReturn {
  const width = React.useSyncExternalStore(
    subscribe,
    getSnapshot,
    getServerSnapshot
  )

  return React.useMemo(
    () => ({
      width,
      size: screenSizeFor(width),
      isMobile: width < BREAKPOINTS.md,
      isTablet: width >= BREAKPOINTS.md && width < BREAKPOINTS.lg,
      isDesktop: width >= BREAKPOINTS.lg,
    }),
    [width]
  )
}
