// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: Apache-2.0

import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}


// naturalCompare - case- and accent-insensitive, numeric-aware ("Sprint 2"
// before "Sprint 10"), locale-undefined. Use it for any user-facing list sorted
// by a name, title or label; SQL orders by intrinsic columns only.
const naturalCollator = new Intl.Collator(undefined, {
  sensitivity: 'base',
  numeric: true,
})

export function naturalCompare(a: string, b: string): number {
  return naturalCollator.compare(a, b)
}

// The numeric value of one version segment: its leading digits, 0 if none.
function versionNumber(segment: string): number {
  const digits = /^\d+/.exec(segment)
  return digits ? parseInt(digits[0], 10) : 0
}

// True if any segment carries more than digits (2.0-rc1, 1.0b).
function versionSuffixed(parts: string[]): boolean {
  return parts.some((p) => !/^\d+$/.test(p))
}

// Compare two version strings semantically (e.g., "1.2" vs "1.13").
// Returns negative if a < b, positive if a > b, 0 if equal. Numerically equal
// versions do not tie: a bare version outranks a suffixed one (2.0 is the
// release 2.0-rc2 led up to), and two suffixed versions order by their text.
// This mirrors the publisher's version_greater, so the web sorts what the
// server keeps.
export function compareVersions(a: string, b: string): number {
  const partsA = a.split('.')
  const partsB = b.split('.')

  const maxLen = Math.max(partsA.length, partsB.length)
  for (let i = 0; i < maxLen; i++) {
    const numA = i < partsA.length ? versionNumber(partsA[i]) : 0
    const numB = i < partsB.length ? versionNumber(partsB[i]) : 0
    if (numA !== numB) {
      return numA - numB
    }
  }
  const suffixedA = versionSuffixed(partsA)
  const suffixedB = versionSuffixed(partsB)
  if (suffixedA !== suffixedB) {
    return suffixedA ? -1 : 1
  }
  if (suffixedA) {
    return a < b ? -1 : a > b ? 1 : 0
  }
  return 0
}
