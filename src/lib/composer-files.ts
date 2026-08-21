// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: Apache-2.0

import { pendingFileSignature } from './attachment-utils'

/**
 * Appends only the files not already staged, matched on the signature rather
 * than the React key. Returns `prev` untouched when everything was a duplicate,
 * so preview object URLs keyed off the array reference are not rebuilt.
 */
export function mergePendingFiles(prev: File[], incoming: File[]): File[] {
  const added = newPendingFiles(prev, incoming)
  return added.length > 0 ? [...prev, ...added] : prev
}

/**
 * The same dedupe for composers with no `File[]` to merge into: the edit forms
 * hold saved attachments and new files in one list.
 */
export function newPendingFiles(staged: File[], incoming: File[]): File[] {
  const seen = new Set(staged.map(pendingFileSignature))
  return incoming.filter((file) => {
    const signature = pendingFileSignature(file)
    if (seen.has(signature)) return false
    seen.add(signature)
    return true
  })
}
