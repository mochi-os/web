// Copyright © 2026 Mochi OÜ
// SPDX-License-Identifier: Apache-2.0

import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function sleep(ms: number = 1000) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

// naturalCompare(a, b) — case-insensitive, accent-insensitive, numeric-aware
// string comparison for in-memory sorts. Use this in `Array.prototype.sort`
// for any user-facing list ordered by a name/title/label string.
//
// Comparator behaviour:
//   - "café" sorts equal to "cafe"
//   - "Über" sorts equal to "uber"
//   - "Sprint 2" sorts before "Sprint 10" (numeric: true)
//   - Locale-undefined; uses the engine's root collator so behaviour is
//     consistent regardless of viewer language.
//
// Rule: do not sort by user-facing strings in SQL — fetch unsorted (or order
// by an intrinsic column like rank/created) and sort with naturalCompare here.
const naturalCollator = new Intl.Collator(undefined, {
  sensitivity: 'base',
  numeric: true,
})

export function naturalCompare(a: string, b: string): number {
  return naturalCollator.compare(a, b)
}

// Compare two version strings semantically (e.g., "1.2" vs "1.13")
// Returns negative if a < b, positive if a > b, 0 if equal
export function compareVersions(a: string, b: string): number {
  const partsA = a.split('.').map((p) => parseInt(p, 10) || 0)
  const partsB = b.split('.').map((p) => parseInt(p, 10) || 0)

  const maxLen = Math.max(partsA.length, partsB.length)
  for (let i = 0; i < maxLen; i++) {
    const numA = partsA[i] ?? 0
    const numB = partsB[i] ?? 0
    if (numA !== numB) {
      return numA - numB
    }
  }
  return 0
}

/**
 * Generates page numbers for pagination with ellipsis
 * @param currentPage - Current page number (1-based)
 * @param totalPages - Total number of pages
 * @returns Array of page numbers and ellipsis strings
 *
 * Examples:
 * - Small dataset (≤5 pages): [1, 2, 3, 4, 5]
 * - Near beginning: [1, 2, 3, 4, '...', 10]
 * - In middle: [1, '...', 4, 5, 6, '...', 10]
 * - Near end: [1, '...', 7, 8, 9, 10]
 */
export function getPageNumbers(currentPage: number, totalPages: number) {
  const maxVisiblePages = 5 // Maximum number of page buttons to show
  const rangeWithDots = []

  if (totalPages <= maxVisiblePages) {
    // If total pages is 5 or less, show all pages
    for (let i = 1; i <= totalPages; i++) {
      rangeWithDots.push(i)
    }
  } else {
    // Always show first page
    rangeWithDots.push(1)

    if (currentPage <= 3) {
      // Near the beginning: [1] [2] [3] [4] ... [10]
      for (let i = 2; i <= 4; i++) {
        rangeWithDots.push(i)
      }
      rangeWithDots.push('...', totalPages)
    } else if (currentPage >= totalPages - 2) {
      // Near the end: [1] ... [7] [8] [9] [10]
      rangeWithDots.push('...')
      for (let i = totalPages - 3; i <= totalPages; i++) {
        rangeWithDots.push(i)
      }
    } else {
      // In the middle: [1] ... [4] [5] [6] ... [10]
      rangeWithDots.push('...')
      for (let i = currentPage - 1; i <= currentPage + 1; i++) {
        rangeWithDots.push(i)
      }
      rangeWithDots.push('...', totalPages)
    }
  }

  return rangeWithDots
}
