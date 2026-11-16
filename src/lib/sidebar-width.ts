// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: Apache-2.0

// Width limits for the drag-resizable desktop sidebar, in CSS pixels.
//
// The floor keeps the shell's desktop menu row inside an expanded sidebar: the
// avatar, Home and two recent apps are four 36 px buttons with three 8 px gaps
// and 8 px padding at each end, 184 px (shell-menu.tsx, menu-apps.tsx). The
// ceiling, and the share of the window, keep the page beside it usable.
export const SIDEBAR_WIDTH_MIN = 224
export const SIDEBAR_WIDTH_MAX = 448
export const SIDEBAR_WIDTH_DEFAULT = 256
const SIDEBAR_WIDTH_VIEWPORT_SHARE = 0.4

/** One arrow-key press on the resize handle. */
export const SIDEBAR_WIDTH_STEP = 16

/** The widest the sidebar may be in a window this wide. */
export function maxSidebarWidth(viewport: number): number {
  return Math.max(
    SIDEBAR_WIDTH_MIN,
    Math.min(
      SIDEBAR_WIDTH_MAX,
      Math.floor(viewport * SIDEBAR_WIDTH_VIEWPORT_SHARE)
    )
  )
}

/**
 * A width the sidebar can take in a window this wide. Applied on every render
 * rather than only when saved, so a window narrowed after a wide drag shrinks
 * the sidebar without forgetting the saved width.
 */
export function clampSidebarWidth(width: number, viewport: number): number {
  return Math.round(
    Math.min(maxSidebarWidth(viewport), Math.max(SIDEBAR_WIDTH_MIN, width))
  )
}

/**
 * A saved width, from a cookie (string) or the shell's init (number), or null
 * when there is none or it is not a width at all. Only the shape is checked
 * here; clampSidebarWidth applies the limits.
 */
export function parseSidebarWidth(value: unknown): number | null {
  if (typeof value === 'string' && value.trim() === '') return null
  if (typeof value !== 'string' && typeof value !== 'number') return null
  const width = Number(value)
  return Number.isFinite(width) && width > 0 ? Math.round(width) : null
}
