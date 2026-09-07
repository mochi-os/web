// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: Apache-2.0

/**
 * The colour the browser chrome should take: the page background token the
 * active Mochi theme defines, read from the root element. The plain
 * light/dark pair is only for a document that has no theme applied yet.
 */
export function themeColor(resolvedTheme: string | undefined): string {
  const background = getComputedStyle(document.documentElement).getPropertyValue('--background').trim()
  if (background) return background
  return resolvedTheme === 'dark' ? '#1a1a1a' : '#fff'
}
