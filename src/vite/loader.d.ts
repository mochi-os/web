// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: Apache-2.0

export function loader(
  manifest: [string[], Array<[number, number[]]>],
  entry: string,
  styles?: string[],
  shared?: {
    names: Record<string, string>
    files: Record<string, string>
    menu: string
  }
): void
