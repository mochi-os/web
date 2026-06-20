// Copyright © 2026 Mochi OÜ
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
  const [width, setWidth] = React.useState<number>(() => {
    if (typeof window !== 'undefined') {
      return window.innerWidth
    }
    return 0
  })

  React.useEffect(() => {
    const handleResize = () => {
      setWidth(window.innerWidth)
    }

    // Set initial value
    handleResize()

    // Add event listener
    window.addEventListener('resize', handleResize)

    // Cleanup
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  // Calculate current size
  const size: ScreenSize = React.useMemo(() => {
    if (width >= BREAKPOINTS['2xl']) return '2xl'
    if (width >= BREAKPOINTS.xl) return 'xl'
    if (width >= BREAKPOINTS.lg) return 'lg'
    if (width >= BREAKPOINTS.md) return 'md'
    if (width >= BREAKPOINTS.sm) return 'sm'
    return 'xs'
  }, [width])

  // Semantic helpers
  const isMobile = width < BREAKPOINTS.md
  const isTablet = width >= BREAKPOINTS.md && width < BREAKPOINTS.lg
  const isDesktop = width >= BREAKPOINTS.lg

  return {
    width,
    size,
    isMobile,
    isTablet,
    isDesktop,
  }
}
